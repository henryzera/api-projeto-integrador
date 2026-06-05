import { Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import type { UpdateChecklistInput } from '../schemas/checklist.schemas';
import { getChecklist, updateChecklist } from '../services/checklist.service';

export async function getChecklistController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const id = String(req.params.id);
  const checklist = await getChecklist(req.user.objectId, id, req.user.cnae);

  return res.status(200).json(checklist);
}

export async function updateChecklistController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const id = String(req.params.id);
  const payload = req.body as UpdateChecklistInput;
  const checklist = await updateChecklist(req.user.objectId, id, payload, req.user.cnae);

  return res.status(200).json(checklist);
}
