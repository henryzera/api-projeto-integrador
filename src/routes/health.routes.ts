import { Router, Request, Response } from 'express';

import { env } from '../config/env';
import { pingMongo } from '../database/mongo';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const mongoConnected = await pingMongo();

  return res.status(200).json({
    app: env.APP_NAME,
    environment: env.NODE_ENV,
    mongo: mongoConnected ? 'connected' : 'disconnected',
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}));

export default router;
