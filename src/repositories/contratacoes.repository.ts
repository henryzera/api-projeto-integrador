import { ObjectId } from 'mongodb';

import { getMongoCollection } from '../database/mongo';

type Pagination = {
  limit: number;
  skip: number;
};

export async function countContratacoes(filter: Record<string, unknown>): Promise<number> {
  const collection = await getMongoCollection();

  return collection.countDocuments(filter);
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
