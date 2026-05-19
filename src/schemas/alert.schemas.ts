import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { alertStatuses } from '../models/alert.model';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format');

export const listAlertsQuerySchema = z
  .object({
    from: dateOnlySchema.optional(),
    priority: z.coerce.number().int().min(1).max(5).optional(),
    status: z.enum(alertStatuses).optional(),
    to: dateOnlySchema.optional(),
    view: z.enum(['list', 'calendar']).default('list')
  })
  .strict()
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: '`from` must be before or equal to `to`',
    path: ['from']
  });

export const alertParamsSchema = z.object({
  id: z.string().refine(ObjectId.isValid, 'Invalid alert id')
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
