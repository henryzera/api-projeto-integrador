import { ObjectId } from 'mongodb';

import { env } from '../config/env';
import { getMongoCollection } from '../database/mongo';
import type { CompanyDocumentRecord, CompanyDocumentWithId } from '../models/document.model';

async function getDocumentsCollection() {
  return getMongoCollection<CompanyDocumentRecord>(env.MONGO_DOCUMENTS_COLLECTION);
}

export async function ensureDocumentIndexes(): Promise<void> {
  const documents = await getDocumentsCollection();

  await Promise.all([
    documents.createIndex({ userId: 1, categoryId: 1 }),
    documents.createIndex({ userId: 1, expiresAt: 1 }),
    documents.createIndex({ userId: 1, updatedAt: -1 })
  ]);
}

export async function countDocumentsByUser(userId: ObjectId): Promise<number> {
  const documents = await getDocumentsCollection();

  return documents.countDocuments({ userId });
}

export async function insertDocuments(items: CompanyDocumentRecord[]): Promise<void> {
  if (items.length === 0) {
    return;
  }

  const documents = await getDocumentsCollection();

  await documents.insertMany(items);
}

export async function findDocumentsByUser(userId: ObjectId): Promise<CompanyDocumentWithId[]> {
  const documents = await getDocumentsCollection();

  return documents.find({ userId }).sort({ categoryId: 1, name: 1 }).toArray();
}

export async function createDocument(document: CompanyDocumentRecord): Promise<CompanyDocumentWithId> {
  const documents = await getDocumentsCollection();
  const result = await documents.insertOne(document);

  return {
    ...document,
    _id: result.insertedId
  };
}

export async function updateDocumentById(
  userId: ObjectId,
  id: string,
  updates: Partial<CompanyDocumentRecord>
): Promise<CompanyDocumentWithId | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const documents = await getDocumentsCollection();

  return documents.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      userId
    },
    {
      $set: updates
    },
    {
      returnDocument: 'after'
    }
  );
}

export async function deleteDocumentById(userId: ObjectId, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const documents = await getDocumentsCollection();
  const result = await documents.deleteOne({
    _id: new ObjectId(id),
    userId
  });

  return result.deletedCount === 1;
}
