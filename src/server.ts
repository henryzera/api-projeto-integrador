import { Server } from 'http';

import app from './app';
import { env } from './config/env';
import { closeMongo, connectMongo } from './database/mongo';
import { ensureAlertIndexes } from './repositories/alert.repository';
import { ensureChecklistIndexes } from './repositories/checklist.repository';
import { ensureDocumentIndexes } from './repositories/document.repository';
import { ensureRevokedTokenIndexes } from './repositories/revoked-token.repository';
import { ensureUserIndexes } from './repositories/user.repository';
import { logger } from './utils/logger';

let server: Server;
let isShuttingDown = false;

async function startServer() {
  await connectMongo();
  await Promise.all([
    ensureAlertIndexes(),
    ensureChecklistIndexes(),
    ensureDocumentIndexes(),
    ensureRevokedTokenIndexes(),
    ensureUserIndexes()
  ]);

  server = app.listen(env.PORT, () => {
    logger.info('server_started', {
      environment: env.NODE_ENV,
      port: env.PORT
    });
  });
}

async function gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('shutdown_started', { signal });

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
