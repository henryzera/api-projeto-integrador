import { ObjectId } from 'mongodb';
import { z } from 'zod';

export const listContratacoesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    modalidadeNome: z.string().trim().max(120).optional(),
    municipioNome: z.string().trim().max(120).optional(),
    skip: z.coerce.number().int().min(0).default(0),
    situacaoCompraNome: z.string().trim().max(120).optional(),
    ufSigla: z.string().trim().length(2).toUpperCase().optional()
  })
  .strict();

export const contratacaoParamsSchema = z.object({
  id: z.string().refine(ObjectId.isValid, 'Invalid document id')
});

export type ListContratacoesQuery = z.infer<typeof listContratacoesQuerySchema>;
