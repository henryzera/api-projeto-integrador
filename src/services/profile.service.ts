import type { ObjectId } from 'mongodb';

import { AppError } from '../errors/AppError';
import { toPublicUser } from '../mappers/user.mapper';
import { deleteAlertsByUser, findAlerts } from '../repositories/alert.repository';
import { deleteChecklistsByUser, findChecklistsByUser } from '../repositories/checklist.repository';
import { deleteDocumentsByUser, findDocumentsByUser } from '../repositories/document.repository';
import { deletePasswordResetsByUser } from '../repositories/password-reset.repository';
import { revokeToken } from '../repositories/revoked-token.repository';
import { deleteUserById, findUserById } from '../repositories/user.repository';
import { logger } from '../utils/logger';

// Servico que implementa os direitos do titular previstos na LGPD:
// - ACESSO + PORTABILIDADE: exportacao de todos os dados pessoais (exportUserData)
// - ESQUECIMENTO: exclusao da conta com cascata (deleteUserAccount)

export async function exportUserData(userId: ObjectId) {
  const user = await findUserById(userId.toString());

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const [documents, checklists, alerts] = await Promise.all([
    findDocumentsByUser(userId),
    findChecklistsByUser(userId),
    findAlerts({ userId })
  ]);

  // Reusamos o mapper publico para o perfil (sem passwordHash). Os demais
  // registros sao serializados com seus _id convertidos para string.
  return {
    exportedAt: new Date().toISOString(),
    profile: toPublicUser(user),
    documents: documents.map((document) => ({
      ...document,
      _id: document._id.toString(),
      userId: document.userId.toString()
    })),
    checklists: checklists.map((checklist) => ({
      ...checklist,
      _id: checklist._id.toString(),
      userId: checklist.userId.toString()
    })),
    alerts: alerts.map((alert) => ({
      ...alert,
      _id: alert._id.toString(),
      userId: alert.userId.toString()
    }))
  };
}

type DeleteAccountInput = {
  userId: ObjectId;
  jti: string;
  tokenExpiresAt: Date;
};

export async function deleteUserAccount(input: DeleteAccountInput): Promise<{ message: string }> {
  const { userId } = input;

  // Cascata idempotente: deleteMany/deleteOne nao falham se nao houver registros.
  // Revogamos o token atual ANTES (best-effort) para que, mesmo se algo abaixo
  // falhar, a sessao em uso ja nao seja mais valida.
  await revokeToken({
    expiresAt: input.tokenExpiresAt,
    jti: input.jti,
    revokedAt: new Date(),
    userId
  });

  const [documentsRemoved, checklistsRemoved, alertsRemoved] = await Promise.all([
    deleteDocumentsByUser(userId),
    deleteChecklistsByUser(userId),
    deleteAlertsByUser(userId)
  ]);

  await deletePasswordResetsByUser(userId);

  const userRemoved = await deleteUserById(userId);

  logger.info('user_account_deleted', {
    alertsRemoved,
    checklistsRemoved,
    documentsRemoved,
    userId: userId.toString(),
    userRemoved
  });

  return {
    message: 'Conta e dados associados removidos com sucesso.'
  };
}
