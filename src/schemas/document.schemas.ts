import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { documentStatuses } from '../models/document.model';

const nullableDateSchema = z.preprocess((value) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  return value;
}, z.coerce.date().nullable());

const nullableUrlSchema = z.preprocess((value) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  return value;
}, z.string().trim().url().nullable());

export const documentParamsSchema = z.object({
  id: z.string().refine(ObjectId.isValid, 'Invalid document id')
});

export const createDocumentSchema = z
  .object({
    categoryId: z.string().trim().min(2).max(80),
    categoryTitle: z.string().trim().min(2).max(120).optional(),
    expiresAt: nullableDateSchema.optional(),
    fileUrl: nullableUrlSchema.optional(),
    name: z.string().trim().min(2).max(160),
    status: z.enum(documentStatuses).optional()
  })
  .strict();

export const updateDocumentSchema = createDocumentSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
