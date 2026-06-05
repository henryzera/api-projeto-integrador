import type { ObjectId } from 'mongodb';

import { AppError } from '../errors/AppError';
import type { AlertRecord, AlertStatus, AlertWithId, PublicAlert } from '../models/alert.model';
import { findAlerts, updateAlertStatus, upsertAlertBySourceKey } from '../repositories/alert.repository';
import { findContratacoesPool } from '../repositories/contratacoes.repository';
import { findDocumentsByUser } from '../repositories/document.repository';
import type { ListAlertsQuery } from '../schemas/alert.schemas';
import { calculateCompatibilityScore } from '../utils/contratacaoCompatibility';
import { listDocuments, resolveDocumentStatus } from './document.service';

export async function listAlerts(
  userId: ObjectId,
  cnae: string,
  query: ListAlertsQuery
): Promise<{ data: PublicAlert[] }> {
  await syncAutomaticAlerts(userId, cnae);

  const filter = buildAlertsFilter(userId, query);
  const alerts = await findAlerts(filter);

  return {
    data: alerts.map(serializeAlert)
  };
}

export async function markAlertAsRead(userId: ObjectId, id: string): Promise<{ alert: PublicAlert }> {
  return updateStatus(userId, id, 'read');
}

export async function resolveAlert(userId: ObjectId, id: string): Promise<{ alert: PublicAlert }> {
  return updateStatus(userId, id, 'resolved');
}

async function updateStatus(userId: ObjectId, id: string, status: AlertStatus): Promise<{ alert: PublicAlert }> {
  const alert = await updateAlertStatus(userId, id, status);

  if (!alert) {
    throw new AppError(404, 'Alert not found');
  }

  return {
    alert: serializeAlert(alert)
  };
}

// Teto do pool de contratacoes consideradas para gerar alertas. Em vez de varrer
// indiscriminadamente as primeiras N (antigo cap fixo de 50), buscamos um pool
// maior e filtramos por relevancia ao usuario (UF do usuario quando disponivel
// e/ou compatibilidade de CNAE >= limiar) antes de gerar alertas.
const alertPoolLimit = 300;

// Limiar minimo de compatibilidade (0-100) para considerar um edital relevante
// ao CNAE do usuario nos alertas de prazo e de novos editais compativeis.
const proposalRelevanceThreshold = 50;
const compatibleNoticeThreshold = 60;

async function syncAutomaticAlerts(userId: ObjectId, cnae: string, userUf?: string): Promise<void> {
  await listDocuments(userId);

  const now = new Date();
  const contratacoes = await findContratacoesPool(buildRelevanceFilter(userUf), alertPoolLimit);

  const documentAlerts = await buildDocumentAlerts(userId);
  const proposalAlerts = buildProposalAlertRecords(contratacoes, userId, cnae, now);
  const infoAlerts = buildCompatibleNoticeAlertRecords(contratacoes, userId, cnae, now);

  await Promise.all([...documentAlerts, ...proposalAlerts, ...infoAlerts].map(upsertAlertBySourceKey));
}

// Filtro de relevancia aplicado no Mongo: restringe por UF do usuario quando
// disponivel. A compatibilidade por CNAE e aplicada em memoria sobre o pool.
export function buildRelevanceFilter(userUf?: string): Record<string, unknown> {
  if (!userUf) {
    return {};
  }

  const normalizedUf = userUf.trim().toUpperCase();
  const ufRegex = new RegExp(`^${normalizedUf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  return {
    $or: [{ 'unidadeOrgao.ufSigla': ufRegex }, { uf: ufRegex }]
  };
}

async function buildDocumentAlerts(userId: ObjectId): Promise<AlertRecord[]> {
  const documents = await findDocumentsByUser(userId);
  const now = new Date();

  return documents
    .map((document): AlertRecord | null => {
      const status = resolveDocumentStatus(document);

      if (status !== 'expired' && status !== 'attention' && status !== 'pending') {
        return null;
      }

      const isExpired = status === 'expired';
      const isPending = status === 'pending';

      return {
        createdAt: now,
        date: toDateOnly(document.expiresAt ?? now),
        description: isExpired
          ? 'Documento vencido precisa ser regularizado'
          : isPending
            ? 'Documento pendente precisa ser anexado'
            : 'Documento vence nos proximos 30 dias',
        kind: isExpired ? 'documentExpired' : 'info',
        priority: isExpired ? 1 : 2,
        relatedId: document._id.toString(),
        relatedType: 'document',
        sourceKey: `document:${document._id.toString()}`,
        status: 'open',
        title: document.name,
        updatedAt: now,
        userId
      };
    })
    .filter((alert): alert is AlertRecord => Boolean(alert));
}

// Funcao pura e testavel: gera os AlertRecord de prazo de proposta a partir de
// um conjunto de contratacoes ja considerado relevante. Filtra por compatibilidade
// de CNAE >= limiar e por prazo (0..15 dias).
export function buildProposalAlertRecords(
  contratacoes: Array<Record<string, unknown>>,
  userId: ObjectId,
  cnae: string,
  now: Date = new Date()
): AlertRecord[] {
  return contratacoes
    .filter((contratacao) => calculateCompatibilityScore(contratacao, cnae) >= proposalRelevanceThreshold)
    .map((contratacao): AlertRecord | null => {
      const deadline = parseDate(contratacao.dataEncerramentoProposta);

      if (!deadline) {
        return null;
      }

      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);

      if (daysUntilDeadline < 0 || daysUntilDeadline > 15) {
        return null;
      }

      const kind = daysUntilDeadline <= 1
        ? 'proposalCritical'
        : daysUntilDeadline <= 3
          ? 'proposalSoon'
          : 'proposalSafe';
      const priority = daysUntilDeadline <= 1 ? 1 : daysUntilDeadline <= 3 ? 2 : 3;
      const id = String(contratacao._id);

      return {
        createdAt: now,
        date: toDateOnly(deadline),
        description: daysUntilDeadline <= 1
          ? 'Prazo encerra em ate 24 horas'
          : `Prazo encerra em ${daysUntilDeadline} dias`,
        kind,
        priority,
        relatedId: id,
        relatedType: 'contratacao',
        sourceKey: `proposal:${id}`,
        status: 'open',
        title: getContratacaoTitle(contratacao),
        updatedAt: now,
        userId
      };
    })
    .filter((alert): alert is AlertRecord => Boolean(alert));
}

// Funcao pura e testavel: gera os AlertRecord informativos de novos editais com
// boa compatibilidade de CNAE (>= limiar). Limita a 10 para nao inundar a caixa.
export function buildCompatibleNoticeAlertRecords(
  contratacoes: Array<Record<string, unknown>>,
  userId: ObjectId,
  cnae: string,
  now: Date = new Date()
): AlertRecord[] {
  return contratacoes
    .filter((contratacao) => calculateCompatibilityScore(contratacao, cnae) >= compatibleNoticeThreshold)
    .slice(0, 10)
    .map((contratacao) => {
      const id = String(contratacao._id);

      return {
        createdAt: now,
        date: toDateOnly(parseDate(contratacao.dataPublicacaoPncp) ?? parseDate(contratacao.dataAtualizacao) ?? now),
        description: 'Novo edital com boa compatibilidade com o CNAE da empresa',
        kind: 'info',
        priority: 4,
        relatedId: id,
        relatedType: 'contratacao',
        sourceKey: `compatible:${id}`,
        status: 'open',
        title: getContratacaoTitle(contratacao),
        updatedAt: now,
        userId
      } satisfies AlertRecord;
    });
}

function buildAlertsFilter(userId: ObjectId, query: ListAlertsQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    userId
  };

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.from || query.to) {
    filter.date = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {})
    };
  }

  return filter;
}

function serializeAlert(alert: AlertWithId): PublicAlert {
  return {
    id: alert._id.toString(),
    date: alert.date,
    description: alert.description,
    kind: alert.kind,
    priority: alert.priority,
    relatedId: alert.relatedId ?? null,
    relatedType: alert.relatedType ?? null,
    status: alert.status,
    title: alert.title
  };
}

function getContratacaoTitle(contratacao: Record<string, unknown>): string {
  const objetoCompra = contratacao.objetoCompra;
  const numeroCompra = contratacao.numeroCompra;

  if (typeof objetoCompra === 'string' && objetoCompra.trim()) {
    return objetoCompra.length > 90 ? `${objetoCompra.slice(0, 87)}...` : objetoCompra;
  }

  return typeof numeroCompra === 'string' ? `Edital ${numeroCompra}` : 'Novo edital disponivel';
}

// Parsing de datas padronizado para UTC explicito. Strings sem informacao de
// timezone (ex.: "2026-06-12T10:00:00" vindas do ETL/PNCP) sao interpretadas
// como UTC para evitar ambiguidade conforme o timezone do servidor. Strings com
// TZ explicito (Z ou +/-HH:MM) sao respeitadas como vierem.
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
    const isDateTimeWithoutTz = /^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/i.test(trimmed) && !hasTimezone;
    const normalized = isDateTimeWithoutTz ? `${trimmed}Z` : trimmed;
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
