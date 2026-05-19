import { Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import { getUserDashboard } from '../services/dashboard.service';

export async function getMeDashboardController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const dashboard = await getUserDashboard(req.user.objectId, req.user.cnae);

  return res.status(200).json(dashboard);
}
