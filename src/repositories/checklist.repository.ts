import { ObjectId } from 'mongodb';

import { env } from '../config/env';
import { getMongoCollection } from '../database/mongo';
import type { ChecklistRecord, ChecklistWithId } from '../models/checklist.model';

async function getChecklistCollection() {
  return getMongoCollection<ChecklistRecord>(env.MONGO_CHECKLISTS_COLLECTION);
}

export async function ensureChecklistIndexes(): Promise<void> {
  const checklists = await getChecklistCollection();

  await checklists.createIndex({ userId: 1, contratacaoId: 1 }, { unique: true });
}

export async function findChecklist(
  userId: ObjectId,
  contratacaoId: string
): Promise<ChecklistWithId | null> {
  const checklists = await getChecklistCollection();

  return checklists.findOne({ userId, contratacaoId });
}

export async function findChecklistsByUser(userId: ObjectId): Promise<ChecklistWithId[]> {
  const checklists = await getChecklistCollection();

  return checklists.find({ userId }).toArray();
}

export async function upsertChecklist(record: ChecklistRecord): Promise<ChecklistWithId> {
  const checklists = await getChecklistCollection();

  const result = await checklists.findOneAndUpdate(
    {
      userId: record.userId,
      contratacaoId: record.contratacaoId
    },
    {
      $set: {
        participationStatus: record.participationStatus,
        items: record.items,
        updatedAt: record.updatedAt
      },
      $setOnInsert: {
        userId: record.userId,
        contratacaoId: record.contratacaoId,
        createdAt: record.createdAt
      }
    },
    {
      returnDocument: 'after',
      upsert: true
    }
  );

  if (!result) {
    throw new Error('Failed to upsert checklist');
  }

  return result;
}
