import { Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import { deleteUserAccount, exportUserData } from '../services/profile.service';

// Direitos do titular (LGPD): exportacao (acesso/portabilidade) e exclusao
// (esquecimento). Ambos exigem autenticacao (requireAuth).

export async function exportMyDataController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const data = await exportUserData(req.user.objectId);

  // Cabecalhos que sinalizam download de um JSON com os dados pessoais.
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="meus-dados.json"');

  return res.status(200).json(data);
}

export async function deleteMeController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const result = await deleteUserAccount({
    jti: req.user.jti,
    tokenExpiresAt: req.user.expiresAt,
    userId: req.user.objectId
  });

  return res.status(200).json(result);
}
