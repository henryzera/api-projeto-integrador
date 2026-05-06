import { AppError } from '../errors/AppError';
import {
  countContratacoes,
  findContratacaoById,
  findContratacoes
} from '../repositories/contratacoes.repository';
import type { ListContratacoesQuery } from '../schemas/contratacoes.schemas';

export async function listContratacoes(input: ListContratacoesQuery) {
  const filter = buildContratacoesFilter(input);

  const [total, data] = await Promise.all([
    countContratacoes(filter),
    findContratacoes(filter, {
      limit: input.limit,
      skip: input.skip
    })
  ]);

  return {
    total,
    limit: input.limit,
    skip: input.skip,
    data
  };
}

export async function getContratacaoById(id: string) {
  const document = await findContratacaoById(id);

  if (!document) {
    throw new AppError(404, 'Document not found');
  }

  return document;
}

function buildContratacoesFilter(input: ListContratacoesQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (input.ufSigla) {
    filter['unidadeOrgao.ufSigla'] = input.ufSigla;
  }

  if (input.municipioNome) {
    filter['unidadeOrgao.municipioNome'] = input.municipioNome;
  }

  if (input.modalidadeNome) {
    filter.modalidadeNome = input.modalidadeNome;
  }

  if (input.situacaoCompraNome) {
    filter.situacaoCompraNome = input.situacaoCompraNome;
  }

  return filter;
}
