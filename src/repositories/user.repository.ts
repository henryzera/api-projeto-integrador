import { ObjectId } from 'mongodb';

import { env } from '../config/env';
import { getMongoCollection } from '../database/mongo';
import type { UserDocument, UserWithId } from '../models/user.model';

async function getUsersCollection() {
  return getMongoCollection<UserDocument>(env.MONGO_USERS_COLLECTION);
}

export async function ensureUserIndexes(): Promise<void> {
  const users = await getUsersCollection();

  await Promise.all([
    users.createIndex({ emailNormalized: 1 }, { unique: true }),
    users.createIndex({ cnpj: 1 }, { unique: true })
  ]);
}

export async function createUser(user: UserDocument): Promise<UserWithId> {
  const users = await getUsersCollection();
  const result = await users.insertOne(user);

  return {
    ...user,
    _id: result.insertedId
  };
}

export async function findUserByEmail(emailNormalized: string): Promise<UserWithId | null> {
  const users = await getUsersCollection();

  return users.findOne({ emailNormalized });
}

export async function findUserByCnpj(cnpj: string): Promise<UserWithId | null> {
  const users = await getUsersCollection();

  return users.findOne({ cnpj });
}

export async function findUserById(id: string): Promise<UserWithId | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const users = await getUsersCollection();

  return users.findOne({ _id: new ObjectId(id) });
}

export async function updateUserById(id: string, updates: Partial<UserDocument>): Promise<UserWithId | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const users = await getUsersCollection();

  return users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: updates
    },
    {
      returnDocument: 'after'
    }
  );
}

// LGPD - direito ao esquecimento: remove o documento do usuario. Idempotente
// (retorna false se ja nao existia).
export async function deleteUserById(userId: ObjectId): Promise<boolean> {
  const users = await getUsersCollection();
  const result = await users.deleteOne({ _id: userId });

  return result.deletedCount === 1;
}
