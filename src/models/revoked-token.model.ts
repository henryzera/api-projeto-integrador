import type { ObjectId, WithId } from 'mongodb';

export type RevokedTokenDocument = {
  _id?: ObjectId;
  expiresAt: Date;
  jti: string;
  revokedAt: Date;
  userId: ObjectId;
};

export type RevokedTokenWithId = WithId<RevokedTokenDocument>;
