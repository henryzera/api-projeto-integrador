import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  CORS_ORIGIN: z.string().default('*'),
  JWT_AUDIENCE: z.string().default('front-projeto-integrador'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_ISSUER: z.string().default('api-projeto-integrador'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  MONGO_COLLECTION: z.string().min(1),
  MONGO_DB_NAME: z.string().min(1),
  MONGO_URI: z.string().min(1),
  MONGO_USERS_COLLECTION: z.string().default('users'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000)
});

export const env = envSchema.parse(process.env);
