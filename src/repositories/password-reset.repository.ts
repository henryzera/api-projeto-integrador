import { ObjectId } from 'mongodb';

import { env } from '../config/env';
import { getMongoCollection } from '../database/mongo';
import type { PasswordResetDocument, PasswordResetWithId } from '../models/password-reset.model';

async function getPasswordResetsCollection() {
  return getMongoCollection<PasswordResetDocument>(env.MONGO_PASSWORD_RESETS_COLLECTION);
}

export async function ensurePasswordResetIndexes(): Promise<void> {
  const passwordResets = await getPasswordResetsCollection();

  await Promise.all([
    passwordResets.createIndex({ tokenHash: 1 }, { unique: true }),
    passwordResets.createIndex({ userId: 1, createdAt: -1 }),
    passwordResets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);
}

export async function createPasswordReset(reset: PasswordResetDocument): Promise<void> {
  const passwordResets = await getPasswordResetsCollection();

  await passwordResets.insertOne(reset);
}

export async function findValidPasswordReset(tokenHash: string): Promise<PasswordResetWithId | null> {
  const passwordResets = await getPasswordResetsCollection();

  return passwordResets.findOne({
    expiresAt: { $gt: new Date() },
    tokenHash,
    $or: [
      { usedAt: null },
      { usedAt: { $exists: false } }
    ]
  });
}

export async function markPasswordResetAsUsed(id: ObjectId): Promise<void> {
  const passwordResets = await getPasswordResetsCollection();

  await passwordResets.updateOne(
    { _id: id },
    {
      $set: {
        usedAt: new Date()
      }
    }
  );
}
