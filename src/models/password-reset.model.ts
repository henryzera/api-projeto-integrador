import type { ObjectId, WithId } from 'mongodb';

export type PasswordResetDocument = {
  _id?: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

export type PasswordResetWithId = WithId<PasswordResetDocument>;
