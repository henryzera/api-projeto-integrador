import { z } from 'zod';

import { isValidCnpj, normalizeEmail, onlyDigits } from '../utils/auth.utils';

const nameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[\p{L}\s.'-]+$/u, 'Name contains invalid characters');

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = z
  .object({
    cnae: z
      .string()
      .transform(onlyDigits)
      .refine((value) => value.length === 7, 'CNAE must have 7 digits'),
    cnpj: z
      .string()
      .transform(onlyDigits)
      .refine(isValidCnpj, 'Invalid CNPJ'),
    confirmPassword: z.string(),
    email: z.string().trim().email().max(255).transform(normalizeEmail),
    firstName: nameSchema,
    lastName: nameSchema,
    password: passwordSchema
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(3).max(255),
    password: z.string().min(1).max(128)
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
