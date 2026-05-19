import { z } from 'zod';

import { isValidCnpj, normalizeEmail, onlyDigits } from '../utils/auth.utils';

const nameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[\p{L}\s.'-]+$/u, 'Name contains invalid characters');

export const passwordSchema = z
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

export const forgotPasswordSchema = z
  .object({
    identifier: z.string().trim().min(3).max(255)
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string(),
    password: passwordSchema,
    token: z.string().trim().min(32).max(256)
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
