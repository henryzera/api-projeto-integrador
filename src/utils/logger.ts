import { maskSensitiveMeta } from './maskSensitive';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown>;

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = isLogLevel(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : 'info';

function isLogLevel(value: string | undefined): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}

function shouldLog(level: LogLevel): boolean {
  return levelWeight[level] >= levelWeight[configuredLevel];
}

function writeLog(level: LogLevel, message: string, meta?: LogMeta): void {
  if (!shouldLog(level)) {
    return;
  }

  // Mascaramos PII/segredos de forma centralizada antes de serializar. Assim,
  // qualquer chamada de log (requestLogger, errorHandler, services) fica
  // protegida contra vazamento de e-mail, CNPJ, tokens e senhas nos logs.
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: maskSensitiveMeta(meta) as LogMeta } : {})
  };

  const output = JSON.stringify(entry, (_key, value) => {
    if (value instanceof Error) {
      return {
        message: value.message,
        name: value.name,
        stack: value.stack
      };
    }

    return value;
  });

  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.log(output);
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => writeLog('debug', message, meta),
  error: (message: string, meta?: LogMeta) => writeLog('error', message, meta),
  info: (message: string, meta?: LogMeta) => writeLog('info', message, meta),
  warn: (message: string, meta?: LogMeta) => writeLog('warn', message, meta)
};
