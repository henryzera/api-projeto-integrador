import type { ObjectId } from 'mongodb';

import type { ChecklistWithId, ParticipationStatus } from '../models/checklist.model';
import { participationStatuses } from '../models/checklist.model';
import { findChecklistsByUser } from '../repositories/checklist.repository';
import { findContratacoes } from '../repositories/contratacoes.repository';
import { calculateCompatibilityScore } from '../utils/contratacaoCompatibility';
import { listAlerts } from './alert.service';
import { getDocumentsSummary } from './document.service';

const dashboardCompatibilityThreshold = 60;

type StatusCounts = Record<ParticipationStatus, number>;

type HistoryEntry = StatusCounts & {
  month: string;
  total: number;
};

export async function getUserDashboard(userId: ObjectId, cnae: string) {
  const [contratacoes, documentsSummary, alerts, checklists] = await Promise.all([
    findContratacoes({}, { limit: 100, skip: 0 }),
    getDocumentsSummary(userId),
    listAlerts(userId, cnae, { status: 'open', view: 'list' }),
    findChecklistsByUser(userId)
  ]);

  const contratacoesCount = contratacoes.filter((contratacao) => {
    return calculateCompatibilityScore(contratacao, cnae) >= dashboardCompatibilityThreshold;
  }).length;

  return {
    contratacoesCount,
    documentHealthPercent: documentsSummary.healthPercent,
    expiredDocumentsCount: documentsSummary.expiredCount,
    openAlertsCount: alerts.data.length,
    pendingDocumentsCount: documentsSummary.pendingCount,
    funnel: buildFunnel(checklists),
    history: buildHistory(checklists)
  };
}

function buildEmptyCounts(): StatusCounts {
  return participationStatuses.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as StatusCounts);
}

function buildFunnel(checklists: ChecklistWithId[]): StatusCounts {
  const funnel = buildEmptyCounts();

  for (const checklist of checklists) {
    funnel[checklist.participationStatus] += 1;
  }

  return funnel;
}

function buildHistory(checklists: ChecklistWithId[]): HistoryEntry[] {
  const byMonth = new Map<string, HistoryEntry>();

  for (const checklist of checklists) {
    const reference = checklist.updatedAt ?? checklist.createdAt;
    const month = formatMonth(reference);

    let entry = byMonth.get(month);

    if (!entry) {
      entry = { month, total: 0, ...buildEmptyCounts() };
      byMonth.set(month, entry);
    }

    entry[checklist.participationStatus] += 1;
    entry.total += 1;
  }

  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function formatMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}
