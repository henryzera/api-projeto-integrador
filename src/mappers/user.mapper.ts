import { defaultNotificationPreferences, type PublicUser, type UserWithId } from '../models/user.model';

// Mapper de saida com allow-list explicita: NUNCA serializa passwordHash nem
// campos internos. Qualquer dado novo sensivel precisa ser deliberadamente
// adicionado aqui para aparecer nas respostas (minimizacao - LGPD/Req 2).
export function toPublicUser(user: UserWithId): PublicUser {
  return {
    id: user._id.toString(),
    acceptedTermsAt: user.acceptedTermsAt ?? null,
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
