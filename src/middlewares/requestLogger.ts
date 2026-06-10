import { RequestHandler } from 'express';

import { logger } from '../utils/logger';

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    // Registramos apenas o pathname (sem query string), pois a query pode conter
    // dados sensiveis (ex.: token de redefinicao de senha) que nao devem ir para
    // os logs. Vide src/utils/maskSensitive.ts para o mascaramento de meta.
    const path = req.originalUrl.split('?')[0];

    logger.info('http_request', {
      durationMs: Math.round(durationMs),
      method: req.method,
      path,
      statusCode: res.statusCode
    });
  });

  return next();
};
