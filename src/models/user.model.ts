import type { ObjectId, WithId } from 'mongodb';

export type UserDocument = {
  _id?: ObjectId;
  // Data/hora de aceite dos termos de uso e politica de privacidade (LGPD:
  // registro de consentimento). Opcional para compatibilidade com usuarios
  // criados antes deste campo existir.
  acceptedTermsAt?: Date | null;
  cnae: string;
  cnpj: string;
  createdAt: Date;
  email: string;
  emailNormalized: string;
  firstName: string;
  lastName: string;
  notificationPreferences?: NotificationPreferences;
  passwordHash: string;
  updatedAt: Date;
};

export type UserWithId = WithId<UserDocument>;

export type PublicUser = {
  id: string;
  acceptedTermsAt: Date | null;
  cnae: string;
  cnpj: string;
  createdAt: Date;
  email: string;
  firstName: string;
  lastName: string;
  notificationPreferences: NotificationPreferences;
  updatedAt: Date;
};

export type NotificationPreferences = {
  documentAlerts: boolean;
  email: boolean;
  proposalAlerts: boolean;
  push: boolean;
  daysBeforeDeadline: number;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  documentAlerts: true,
  email: true,
  proposalAlerts: true,
  push: true,
  daysBeforeDeadline: 3
};
