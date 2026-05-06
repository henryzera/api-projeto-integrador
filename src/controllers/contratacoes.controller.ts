import { Request, Response } from 'express';

import { contratacaoParamsSchema, listContratacoesQuerySchema } from '../schemas/contratacoes.schemas';
import { getContratacaoById, listContratacoes } from '../services/contratacoes.service';

export async function listContratacoesController(req: Request, res: Response) {
  const query = listContratacoesQuerySchema.parse(req.query);
  const result = await listContratacoes(query);

  return res.status(200).json(result);
}

export async function getContratacaoByIdController(req: Request, res: Response) {
  const { id } = contratacaoParamsSchema.parse(req.params);
  const result = await getContratacaoById(id);

  return res.status(200).json(result);
}
