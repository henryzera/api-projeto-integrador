import type { ObjectId } from 'mongodb';

import { env } from '../config/env';
import { getMongoCollection } from '../database/mongo';
import type { PasswordResetDocument, PasswordResetWithId } from '../models/password-reset.model';

async function getPasswordResetsCollection() {
  return getMongoCollection<PasswordResetDocument>(env.MONGO_PASSWORD_RESETS_COLLECTION);
}

export async function ensurePasswordResetIndexes(): Promise<void> {
  const passwordResets = await getPasswordResetsCollection();

  await Promise.all([
    passwordResets.createIndex({ tokenHash: 1 }),
    passwordResets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);
}

export async function deletePasswordResetsByUser(userId: ObjectId): Promise<void> {
  const passwordResets = await getPasswordResetsCollection();

  await passwordResets.deleteMany({ userId });
}

export async function createPasswordReset(record: PasswordResetDocument): Promise<void> {
  const passwordResets = await getPasswordResetsCollection();

  await passwordResets.insertOne(record);
}

export async function findPasswordResetByTokenHash(tokenHash: string): Promise<PasswordResetWithId | null> {
  const passwordResets = await getPasswordResetsCollection();

  return passwordResets.findOne({ tokenHash });
}

export async function deletePasswordResetById(id: ObjectId): Promise<void> {
  const passwordResets = await getPasswordResetsCollection();

  await passwordResets.deleteOne({ _id: id });
}
