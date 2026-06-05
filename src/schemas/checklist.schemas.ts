import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { participationStatuses } from '../models/checklist.model';

export const checklistParamsSchema = z.object({
  id: z.string().refine(ObjectId.isValid, 'Invalid document id')
});

export const updateChecklistSchema = z
  .object({
    participationStatus: z.enum(participationStatuses).optional(),
    items: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          checked: z.boolean()
        })
      )
      .optional()
  })
  .strict()
  .refine((data) => data.participationStatus !== undefined || data.items !== undefined, {
    message: 'At least one of `participationStatus` or `items` must be provided'
  });

export type ChecklistParams = z.infer<typeof checklistParamsSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
