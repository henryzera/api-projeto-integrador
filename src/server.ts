import { Server } from 'http';

import app from './app';
import { env } from './config/env';
import { closeMongo, connectMongo, isMongoConnected } from './database/mongo';
import { ensureAlertIndexes } from './repositories/alert.repository';
import { ensureChecklistIndexes } from './repositories/checklist.repository';
import { ensureContratacoesIndexes } from './repositories/contratacoes.repository';
import { ensureDocumentIndexes } from './repositories/document.repository';
import { ensurePasswordResetIndexes } from './repositories/password-reset.repository';
import { ensureRevokedTokenIndexes } from './repositories/revoked-token.repository';
import { ensureUserIndexes } from './repositories/user.repository';
import { logger } from './utils/logger';

let server: Server;
let isShuttingDown = false;
let reconnectTimer: NodeJS.Timeout | null = null;

const mongoReconnectDelayMs = 5000;

async function ensureIndexes(): Promise<void> {
  // ensureContratacoesIndexes ja e tolerante a falha internamente (colecao
  // populada por servico externo). As demais usam Promise.allSettled para que
  // a falha de uma nao bloqueie as outras nem derrube o boot.
  const results = await Promise.allSettled([
    ensureAlertIndexes(),
    ensureChecklistIndexes(),
    ensureContratacoesIndexes(),
    ensureDocumentIndexes(),
    ensurePasswordResetIndexes(),
    ensureRevokedTokenIndexes(),
    ensureUserIndexes()
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.warn('ensure_indexes_failed', { error: result.reason });
    }
  }
}

async function initMongo(): Promise<void> {
  try {
    await connectMongo();
    await ensureIndexes();

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  } catch (error) {
    logger.error('mongodb_initial_connection_failed', { error });
    scheduleMongoReconnect();
  }
}

function scheduleMongoReconnect(): void {
  if (isShuttingDown || reconnectTimer || isMongoConnected()) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    logger.info('mongodb_reconnect_attempt');
    void initMongo();
  }, mongoReconnectDelayMs);

  // Nao manter o processo vivo apenas por causa do timer de reconexao.
  reconnectTimer.unref?.();
}

function startHttpServer(): void {
  server = app.listen(env.PORT, () => {
    logger.info('server_started', {
      environment: env.NODE_ENV,
      mongo: isMongoConnected() ? 'connected' : 'disconnected',
      port: env.PORT
    });
  });
}

async function startServer() {
  // Boot resiliente: subimos o HTTP server independentemente do Mongo. Se a
  // conexao inicial falhar, /health reporta mongo: disconnected e tentamos
  // reconectar em background. As rotas que dependem do banco retornam erro
  // tratado (5xx amigavel) em vez de derrubar o processo.
  startHttpServer();
  await initMongo();
}

async function gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('shutdown_started', { signal });

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const forcedShutdown = setTimeout(() => {
    logger.error('shutdown_forced');
    process.exit(1);
  }, 10_000);

  const closeResources = async () => {
    await closeMongo();
    clearTimeout(forcedShutdown);
    logger.info('shutdown_completed');
    process.exit(process.exitCode || 0);
  };

  if (!server?.listening) {
    await closeResources();
    return;
  }

  server.close(async (error) => {
    const errorCode = typeof error === 'object' && error && 'code' in error ? error.code : undefined;

    if (error && errorCode !== 'ERR_SERVER_NOT_RUNNING') {
      logger.error('http_server_close_failed', { error });
      process.exitCode = 1;
    }

    await closeResources();
  });
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { error });
  process.exit(1);
});

startServer().catch((error) => {
  logger.error('server_start_failed', { error });
  process.exit(1);
});
