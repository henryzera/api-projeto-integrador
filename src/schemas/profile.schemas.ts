import { z } from 'zod';

import { isValidCnpj, normalizeEmail, onlyDigits } from '../utils/auth.utils';

const notificationPreferencesSchema = z
  .object({
    daysBeforeDeadline: z.coerce.number().int().min(1).max(30).optional(),
    documentAlerts: z.boolean().optional(),
    email: z.boolean().optional(),
    proposalAlerts: z.boolean().optional(),
    push: z.boolean().optional()
  })
  .strict();

export const updateMeSchema = z
  .object({
    cnae: z
      .string()
      .transform(onlyDigits)
      .refine((value) => value.length === 7, 'CNAE must have 7 digits')
      .optional(),
    cnpj: z
      .string()
      .transform(onlyDigits)
      .refine(isValidCnpj, 'Invalid CNPJ')
      .optional(),
    email: z.string().trim().email().max(255).transform(normalizeEmail).optional(),
    firstName: z.string().trim().min(2).max(80).optional(),
    lastName: z.string().trim().min(2).max(80).optional(),
    notificationPreferences: notificationPreferencesSchema.optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided'
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
