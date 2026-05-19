import { defaultNotificationPreferences, type PublicUser, type UserWithId } from '../models/user.model';

export function toPublicUser(user: UserWithId): PublicUser {
  return {
    id: user._id.toString(),
    cnae: user.cnae,
    cnpj: user.cnpj,
    createdAt: user.createdAt,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    notificationPreferences: {
      ...defaultNotificationPreferences,
      ...user.notificationPreferences
    },
    updatedAt: user.updatedAt
  };
}
