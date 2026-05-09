import { MongoServerError } from 'mongodb';

import { env } from '../config/env';
import { getMongoCollection } from '../database/mongo';
import type { RevokedTokenDocument } from '../models/revoked-token.model';

async function getRevokedTokensCollection() {
  return getMongoCollection<RevokedTokenDocument>(env.MONGO_REVOKED_TOKENS_COLLECTION);
}

export async function ensureRevokedTokenIndexes(): Promise<void> {
  const revokedTokens = await getRevokedTokensCollection();

  await Promise.all([
    revokedTokens.createIndex({ jti: 1 }, { unique: true }),
    revokedTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);
}

export async function revokeToken(token: RevokedTokenDocument): Promise<void> {
  const revokedTokens = await getRevokedTokensCollection();

  try {
    await revokedTokens.insertOne(token);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return;
    }

    throw error;
  }
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const revokedTokens = await getRevokedTokensCollection();
  const token = await revokedTokens.findOne({ jti });

  return Boolean(token);
}
