import type { ObjectId, WithId } from 'mongodb';

export type PasswordResetDocument = {
  _id?: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  tokenHash: string;
  usedAt?: Date | null;
  userId: ObjectId;
};

export type PasswordResetWithId = WithId<PasswordResetDocument>;
