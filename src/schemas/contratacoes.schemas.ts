import { ObjectId } from 'mongodb';
import { z } from 'zod';

const booleanQuerySchema = z.preprocess((value) => {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
}, z.boolean());

export const listContratacoesQuerySchema = z
  .object({
    cnae: z.string().trim().regex(/^\d{7}$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(12),
    meOnly: booleanQuerySchema.optional(),
    modalidadeNome: z.string().trim().max(120).optional(),
    municipio: z.string().trim().max(120).optional(),
    municipioNome: z.string().trim().max(120).optional(),
    q: z.string().trim().min(1).max(160).optional(),
    skip: z.coerce.number().int().min(0).default(0),
    status: z.string().trim().max(120).optional(),
    situacaoCompraNome: z.string().trim().max(120).optional(),
    uf: z.string().trim().length(2).toUpperCase().optional(),
    ufSigla: z.string().trim().length(2).toUpperCase().optional()
  })
  .strict();

export const contratacaoParamsSchema = z.object({
  id: z.string().refine(ObjectId.isValid, 'Invalid document id')
});

export type ListContratacoesQuery = z.infer<typeof listContratacoesQuerySchema>;
