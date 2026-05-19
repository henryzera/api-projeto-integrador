import type { ObjectId, WithId } from 'mongodb';

export const alertKinds = ['documentExpired', 'info', 'proposalCritical', 'proposalSafe', 'proposalSoon'] as const;
export const alertStatuses = ['open', 'read', 'resolved'] as const;

export type AlertKind = (typeof alertKinds)[number];
export type AlertStatus = (typeof alertStatuses)[number];

export type AlertRecord = {
  _id?: ObjectId;
  createdAt: Date;
  date: string;
  description: string;
  kind: AlertKind;
  priority: number;
  relatedId?: string | null;
  relatedType?: 'contratacao' | 'document' | null;
  sourceKey: string;
  status: AlertStatus;
  title: string;
  updatedAt: Date;
  userId: ObjectId;
};

export type AlertWithId = WithId<AlertRecord>;

export type PublicAlert = {
  id: string;
  date: string;
  description: string;
  kind: AlertKind;
  priority: number;
  relatedId: string | null;
  relatedType: 'contratacao' | 'document' | null;
  status: AlertStatus;
  title: string;
};
