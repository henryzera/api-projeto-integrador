import type { ObjectId, WithId } from 'mongodb';

export const participationStatuses = ['preparing', 'submitted', 'won', 'lost'] as const;

export type ParticipationStatus = (typeof participationStatuses)[number];

export type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
};

export type ChecklistRecord = {
  _id?: ObjectId;
  userId: ObjectId;
  contratacaoId: string;
  participationStatus: ParticipationStatus;
  items: ChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
};

export type ChecklistWithId = WithId<ChecklistRecord>;

export type PublicChecklist = {
  contratacaoId: string;
  participationStatus: ParticipationStatus;
  items: ChecklistItem[];
  updatedAt: string;
};
