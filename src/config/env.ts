import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  APP_NAME: z.string().default('api-projeto-integrador'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_AUDIENCE: z.string().default('front-projeto-integrador'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_ISSUER: z.string().default('api-projeto-integrador'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MONGO_ALERTS_COLLECTION: z.string().default('user_alerts'),
  MONGO_CHECKLISTS_COLLECTION: z.string().default('contratacao_checklists'),
  MONGO_COLLECTION: z.string().min(1),
  MONGO_CONNECT_RETRIES: z.coerce.number().int().min(1).default(5),
  MONGO_CONNECT_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(2000),
  MONGO_DB_NAME: z.string().min(1),
  MONGO_DOCUMENTS_COLLECTION: z.string().default('user_documents'),
  MONGO_PASSWORD_RESETS_COLLECTION: z.string().default('password_resets'),
  MONGO_REVOKED_TOKENS_COLLECTION: z.string().default('revoked_tokens'),
  MONGO_URI: z.string().min(1),
  MONGO_USERS_COLLECTION: z.string().default('users'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // SMTP opcional para envio de e-mail de recuperacao de senha. Se todas as
  // variaveis obrigatorias (HOST/PORT/USER/PASS/FROM) estiverem presentes, o
  // envio por e-mail e habilitado; caso contrario, mantemos o fallback (retorna
  // resetToken em dev + log).
  PASSWORD_RESET_URL_BASE: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  SMTP_USER: z.string().optional()
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables');
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
