import { ObjectId } from 'mongodb';

import { getMongoCollection } from '../database/mongo';
import { logger } from '../utils/logger';

type Pagination = {
  limit: number;
  skip: number;
};

export async function ensureContratacoesIndexes(): Promise<void> {
  // A colecao de contratacoes e populada por um servico externo (ETL). Se a
  // criacao de qualquer indice falhar (ex.: conflito de opcoes com indice ja
  // existente, indice de texto duplicado), apenas logamos e seguimos — nao
  // queremos derrubar o boot por causa de indices nesta colecao.
  const collection = await getMongoCollection();

  const indexes: Array<[Record<string, 1 | -1 | 'text'>, string]> = [
    [{ dataEncerramentoProposta: 1 }, 'dataEncerramentoProposta_1'],
    [{ valorTotalEstimado: 1 }, 'valorTotalEstimado_1'],
    [{ 'unidadeOrgao.ufSigla': 1 }, 'unidadeOrgao_ufSigla_1']
  ];

  for (const [spec, name] of indexes) {
    try {
      await collection.createIndex(spec, { name });
    } catch (error) {
      logger.warn('contratacoes_index_failed', { error, name });
    }
  }

  // Indice de TEXTO para a busca textual (campo `q`). Como uma colecao so pode
  // ter um indice de texto, agrupamos os campos textuais relevantes.
  try {
    await collection.createIndex(
      {
        objetoCompra: 'text',
        modalidadeNome: 'text',
        situacaoCompraNome: 'text',
        'orgaoEntidade.razaoSocial': 'text',
        'unidadeOrgao.nomeUnidade': 'text',
        'unidadeOrgao.municipioNome': 'text'
      },
      { name: 'contratacoes_text' }
    );
  } catch (error) {
    logger.warn('contratacoes_text_index_failed', { error });
  }
}

export async function countContratacoes(filter: Record<string, unknown>): Promise<number> {
  const collection = await getMongoCollection();

  return collection.countDocuments(filter);
}

export async function findContratacoesPool(filter: Record<string, unknown>, poolLimit: number) {
  const collection = await getMongoCollection();

  return collection
    .find(filter)
    .sort({
      dataEncerramentoProposta: 1,
      dataPublicacaoPncp: -1
    })
    .limit(poolLimit)
    .toArray();
}

export async function findContratacoes(filter: Record<string, unknown>, pagination: Pagination) {
  const collection = await getMongoCollection();

  return collection
    .find(filter)
    .sort({
      dataEncerramentoProposta: 1,
      dataPublicacaoPncp: -1
    })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .toArray();
}

export async function findContratacaoById(id: string) {
  const collection = await getMongoCollection();

  return collection.findOne({
    _id: new ObjectId(id)
  });
}
