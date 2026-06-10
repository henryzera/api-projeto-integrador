import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { ObjectId } from 'mongodb';

import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { toPublicUser } from '../mappers/user.mapper';
import { defaultNotificationPreferences, type PublicUser } from '../models/user.model';
import {
  createPasswordReset,
  deletePasswordResetById,
  deletePasswordResetsByUser,
  findPasswordResetByTokenHash
} from '../repositories/password-reset.repository';
import { revokeToken } from '../repositories/revoked-token.repository';
import { createUser, findUserByCnpj, findUserByEmail, findUserById, updateUserById } from '../repositories/user.repository';
import type { UpdateMeInput } from '../schemas/profile.schemas';
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from '../schemas/auth.schemas';
import { normalizeEmail, onlyDigits } from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { buildPasswordResetLink, isEmailEnabled, sendEmail } from './email.service';
import { signAccessToken } from './jwt.service';

const passwordHashRounds = 12;
const passwordResetExpiresInMinutes = 15;

type PasswordResetResponse = {
  message: string;
  expiresInMinutes: number;
  resetToken?: string;
};

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

type AuthResponse = {
  token: string;
  user: PublicUser;
};

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const existingByEmail = await findUserByEmail(input.email);

  if (existingByEmail) {
    throw new AppError(409, 'Email already registered');
  }

  const existingByCnpj = await findUserByCnpj(input.cnpj);

  if (existingByCnpj) {
    throw new AppError(409, 'CNPJ already registered');
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(input.password, passwordHashRounds);
  const user = await createUser({
    acceptedTermsAt: input.acceptTerms ? now : null,
    cnae: input.cnae,
    cnpj: input.cnpj,
    createdAt: now,
    email: input.email,
    emailNormalized: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    notificationPreferences: defaultNotificationPreferences,
    passwordHash,
    updatedAt: now
  });
  const publicUser = toPublicUser(user);

  return {
    token: signAccessToken(publicUser),
    user: publicUser
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const identifier = input.identifier.includes('@')
    ? normalizeEmail(input.identifier)
    : onlyDigits(input.identifier);
  const user = input.identifier.includes('@')
    ? await findUserByEmail(identifier)
    : await findUserByCnpj(identifier);

  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, 'Invalid credentials');
  }

  const publicUser = toPublicUser(user);

  return {
    token: signAccessToken(publicUser),
    user: publicUser
  };
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<PasswordResetResponse> {
  const message = 'Se a conta existir, enviamos as instrucoes de redefinicao.';
  const identifier = input.identifier.includes('@')
    ? normalizeEmail(input.identifier)
    : onlyDigits(input.identifier);
  const user = input.identifier.includes('@')
    ? await findUserByEmail(identifier)
    : await findUserByCnpj(identifier);

  if (!user) {
    return {
      expiresInMinutes: passwordResetExpiresInMinutes,
      message
    };
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + passwordResetExpiresInMinutes * 60 * 1000);

  await deletePasswordResetsByUser(user._id);
  await createPasswordReset({
    createdAt: now,
    expiresAt,
    tokenHash,
    userId: user._id
  });

  logger.info('password_reset_token_generated', {
    expiresAt: expiresAt.toISOString(),
    userId: user._id.toString()
  });

  // Envio plugavel: se SMTP estiver configurado, enviamos o link/token por
  // e-mail. Caso contrario, mantemos o fallback (retornar resetToken em dev +
  // log) para nao quebrar o fluxo atual.
  let emailSent = false;

  if (isEmailEnabled()) {
    const resetLink = buildPasswordResetLink(token);
    const linkLine = resetLink
      ? `Acesse o link para redefinir sua senha: ${resetLink}`
      : `Use o codigo a seguir para redefinir sua senha: ${token}`;

    emailSent = await sendEmail({
      subject: 'Redefinicao de senha',
      text:
        `Recebemos uma solicitacao para redefinir a senha da sua conta.\n\n` +
        `${linkLine}\n\n` +
        `Este link/codigo expira em ${passwordResetExpiresInMinutes} minutos. ` +
        `Se voce nao solicitou, ignore este e-mail.`,
      to: user.email
    });
  }

  return {
    expiresInMinutes: passwordResetExpiresInMinutes,
    message,
    // So expomos o token na resposta quando NAO houve envio por e-mail e nao
    // estamos em producao (fallback de dev).
    ...(!emailSent && env.NODE_ENV !== 'production' ? { resetToken: token } : {})
  };
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
  const tokenHash = hashResetToken(input.token.trim());
  const resetRecord = await findPasswordResetByTokenHash(tokenHash);

  if (!resetRecord || resetRecord.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, 'Reset token is invalid or expired');
  }

  const passwordHash = await bcrypt.hash(input.newPassword, passwordHashRounds);
  const updatedUser = await updateUserById(resetRecord.userId.toString(), {
    passwordHash,
    updatedAt: new Date()
  });

  if (!updatedUser) {
    await deletePasswordResetById(resetRecord._id);

    throw new AppError(400, 'Reset token is invalid or expired');
  }

  await deletePasswordResetsByUser(resetRecord.userId);

  return {
    message: 'Senha redefinida com sucesso.'
  };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return toPublicUser(user);
}

export async function logoutUser(input: { expiresAt: Date; jti: string; userId: ObjectId }): Promise<void> {
  await revokeToken({
    expiresAt: input.expiresAt,
    jti: input.jti,
    revokedAt: new Date(),
    userId: input.userId
  });
}

export async function updateCurrentUser(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  const currentUser = await findUserById(userId);

  if (!currentUser) {
    throw new AppError(404, 'User not found');
  }

  if (input.email && input.email !== currentUser.emailNormalized) {
    const existingUser = await findUserByEmail(input.email);

    if (existingUser && existingUser._id.toString() !== userId) {
      throw new AppError(409, 'Email already registered');
    }
  }

  if (input.cnpj && input.cnpj !== currentUser.cnpj) {
    const existingUser = await findUserByCnpj(input.cnpj);

    if (existingUser && existingUser._id.toString() !== userId) {
      throw new AppError(409, 'CNPJ already registered');
    }
  }

  const { notificationPreferences, ...profileUpdates } = input;
  const updatedUser = await updateUserById(userId, {
    ...profileUpdates,
    ...(profileUpdates.email
      ? {
          email: profileUpdates.email,
          emailNormalized: profileUpdates.email
        }
      : {}),
    ...(notificationPreferences
      ? {
          notificationPreferences: {
            ...defaultNotificationPreferences,
            ...currentUser.notificationPreferences,
            ...notificationPreferences
          }
        }
      : {}),
    updatedAt: new Date()
  });

  if (!updatedUser) {
    throw new AppError(404, 'User not found');
  }

  return toPublicUser(updatedUser);
}
