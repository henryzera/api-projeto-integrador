import cors from 'cors';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { meController, updateMeController } from './controllers/auth.controller';
import { getMeDashboardController } from './controllers/dashboard.controller';
import { deleteMeController, exportMyDataController } from './controllers/profile.controller';
import { requireAuth } from './middlewares/auth.middleware';
import { errorHandler } from './middlewares/errorHandler';
import { createRateLimiter } from './middlewares/rateLimiter';
import { requestLogger } from './middlewares/requestLogger';
import { sanitizeMongo } from './middlewares/sanitizeMongo';
import { validateRequest } from './middlewares/validateRequest';
import alertRoutes from './routes/alert.routes';
import authRoutes from './routes/auth.routes';
import contratacoesRoutes from './routes/contratacoes.routes';
import documentRoutes from './routes/document.routes';
import healthRoutes from './routes/health.routes';
import { updateMeSchema } from './schemas/profile.schemas';
import { asyncHandler } from './utils/asyncHandler';
import { logger } from './utils/logger';

const app = express();

// CORS restritivo em producao: se rodando em producao com CORS_ORIGIN='*',
// emitimos um aviso forte (nao derrubamos o boot para nao quebrar o deploy
// atual). Defina CORS_ORIGIN com a lista de origens confiaveis em producao.
if (env.NODE_ENV === 'production' && env.CORS_ORIGIN === '*') {
  logger.warn('cors_insecure_wildcard_in_production', {
    message:
      'CORS_ORIGIN esta definido como "*" em producao. Isso permite requisicoes de qualquer origem. Configure CORS_ORIGIN com a lista de origens confiaveis (separadas por virgula).'
  });
}

const corsOrigins = env.CORS_ORIGIN === '*'
  ? '*'
  : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

app.set('trust proxy', 1);

app.use(requestLogger);
app.use(helmet());
app.use(compression());
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
// Sanitizacao anti-NoSQL-injection: remove operadores Mongo ($, .) de body,
// params e query antes de qualquer handler. Defesa em profundidade junto da
// validacao Zod. Vide src/middlewares/sanitizeMongo.ts.
app.use(sanitizeMongo);
// Rate limit GLOBAL (disponibilidade / anti-abuso) aplicado a todas as rotas.
// As rotas de /auth tem limiters adicionais mais estritos.
app.use(
  createRateLimiter({
    limit: 300,
    message: 'Too many requests. Try again later.',
    windowMs: 15 * 60 * 1000
  })
);

// rotas
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.get('/me/dashboard', requireAuth, asyncHandler(getMeDashboardController));
// LGPD: exportacao de dados (acesso/portabilidade) e exclusao de conta
// (esquecimento). Vide src/services/profile.service.ts.
app.get('/me/data-export', requireAuth, asyncHandler(exportMyDataController));
app.get('/me', requireAuth, asyncHandler(meController));
app.patch('/me', requireAuth, validateRequest({ body: updateMeSchema }), asyncHandler(updateMeController));
app.delete('/me', requireAuth, asyncHandler(deleteMeController));
app.use('/contratacoes', requireAuth, contratacoesRoutes);
app.use('/documents', requireAuth, documentRoutes);
app.use('/alerts', requireAuth, alertRoutes);

app.use(errorHandler);

export default app;
