import type { ObjectId, WithId } from 'mongodb';

export type UserDocument = {
  _id?: ObjectId;
  cnae: string;
  cnpj: string;
  createdAt: Date;
  email: string;
  emailNormalized: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  updatedAt: Date;
};

export type UserWithId = WithId<UserDocument>;

export type PublicUser = {
  id: string;
  cnae: string;
  cnpj: string;
  createdAt: Date;
  email: string;
  firstName: string;
  lastName: string;
  updatedAt: Date;
};
