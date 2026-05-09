import { RequestHandler } from 'express';

import { logger } from '../utils/logger';

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.info('http_request', {
      durationMs: Math.round(durationMs),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode
    });
  });

  return next();
};
