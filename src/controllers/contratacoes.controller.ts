import { Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import { contratacaoParamsSchema, listContratacoesQuerySchema } from '../schemas/contratacoes.schemas';
import { getContratacaoById, listContratacoes } from '../services/contratacoes.service';

export async function listContratacoesController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const query = listContratacoesQuerySchema.parse(req.query);
  const result = await listContratacoes(query, req.user.cnae);

  return res.status(200).json(result);
}

export async function getContratacaoByIdController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const { id } = contratacaoParamsSchema.parse(req.params);
  const result = await getContratacaoById(id, req.user.cnae);

  return res.status(200).json(result);
}
