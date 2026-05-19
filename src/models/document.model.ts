import type { ObjectId, WithId } from 'mongodb';

export const documentStatuses = ['ok', 'attention', 'expired', 'pending'] as const;

export type DocumentStatus = (typeof documentStatuses)[number];

export type CompanyDocumentRecord = {
  _id?: ObjectId;
  categoryId: string;
  categoryTitle: string;
  createdAt: Date;
  expiresAt?: Date | null;
  fileUrl?: string | null;
  name: string;
  status?: DocumentStatus;
  updatedAt: Date;
  userId: ObjectId;
};

export type CompanyDocumentWithId = WithId<CompanyDocumentRecord>;

export type PublicCompanyDocument = {
  id: string;
  expiresAt: Date | null;
  fileUrl: string | null;
  name: string;
  status: DocumentStatus;
  updatedAt: Date;
};

export type DocumentGroup = {
  id: string;
  title: string;
  summary: string;
  documents: PublicCompanyDocument[];
};
