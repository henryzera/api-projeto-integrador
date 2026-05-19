import { Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import type { ListAlertsQuery } from '../schemas/alert.schemas';
import { listAlerts, markAlertAsRead, resolveAlert } from '../services/alert.service';

export async function listAlertsController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const alerts = await listAlerts(req.user.objectId, req.user.cnae, req.query as unknown as ListAlertsQuery);

  return res.status(200).json(alerts);
}

export async function markAlertAsReadController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const alert = await markAlertAsRead(req.user.objectId, String(req.params.id));

  return res.status(200).json(alert);
}

export async function resolveAlertController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const alert = await resolveAlert(req.user.objectId, String(req.params.id));

  return res.status(200).json(alert);
}
