import type { ObjectId } from 'mongodb';

import { AppError } from '../errors/AppError';
import type { AlertRecord, AlertStatus, AlertWithId, PublicAlert } from '../models/alert.model';
import { findAlerts, updateAlertStatus, upsertAlertBySourceKey } from '../repositories/alert.repository';
import { findContratacoes } from '../repositories/contratacoes.repository';
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

async function syncAutomaticAlerts(userId: ObjectId, cnae: string): Promise<void> {
  await listDocuments(userId);

  const [documentAlerts, proposalAlerts, infoAlerts] = await Promise.all([
    buildDocumentAlerts(userId),
    buildProposalAlerts(userId),
    buildCompatibleNoticeAlerts(userId, cnae)
  ]);

  await Promise.all([...documentAlerts, ...proposalAlerts, ...infoAlerts].map(upsertAlertBySourceKey));
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

async function buildProposalAlerts(userId: ObjectId): Promise<AlertRecord[]> {
  const now = new Date();
  const contratacoes = await findContratacoes({}, { limit: 50, skip: 0 });

  return contratacoes
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

async function buildCompatibleNoticeAlerts(userId: ObjectId, cnae: string): Promise<AlertRecord[]> {
  const now = new Date();
  const contratacoes = await findContratacoes({}, { limit: 50, skip: 0 });

  return contratacoes
    .filter((contratacao) => calculateCompatibilityScore(contratacao, cnae) >= 60)
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

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
