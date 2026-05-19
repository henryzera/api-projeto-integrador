import type { ObjectId } from 'mongodb';

import { findContratacoes } from '../repositories/contratacoes.repository';
import { calculateCompatibilityScore } from '../utils/contratacaoCompatibility';
import { listAlerts } from './alert.service';
import { getDocumentsSummary } from './document.service';

const dashboardCompatibilityThreshold = 60;

export async function getUserDashboard(userId: ObjectId, cnae: string) {
  const [contratacoes, documentsSummary, alerts] = await Promise.all([
    findContratacoes({}, { limit: 100, skip: 0 }),
    getDocumentsSummary(userId),
    listAlerts(userId, cnae, { status: 'open', view: 'list' })
  ]);

  const contratacoesCount = contratacoes.filter((contratacao) => {
    return calculateCompatibilityScore(contratacao, cnae) >= dashboardCompatibilityThreshold;
  }).length;

  return {
    contratacoesCount,
    documentHealthPercent: documentsSummary.healthPercent,
    expiredDocumentsCount: documentsSummary.expiredCount,
    openAlertsCount: alerts.data.length,
    pendingDocumentsCount: documentsSummary.pendingCount
  };
}
