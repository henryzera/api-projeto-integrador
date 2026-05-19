import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { ObjectId } from 'mongodb';

import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { toPublicUser } from '../mappers/user.mapper';
import { defaultNotificationPreferences, type PublicUser } from '../models/user.model';
import {
  createPasswordReset,
  findValidPasswordReset,
  markPasswordResetAsUsed
} from '../repositories/password-reset.repository';
import { revokeToken } from '../repositories/revoked-token.repository';
import { createUser, findUserByCnpj, findUserByEmail, findUserById, updateUserById } from '../repositories/user.repository';
import type { UpdateMeInput } from '../schemas/profile.schemas';
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from '../schemas/auth.schemas';
import { normalizeEmail, onlyDigits } from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { signAccessToken } from './jwt.service';

const passwordHashRounds = 12;

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

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const identifier = input.identifier.includes('@')
    ? normalizeEmail(input.identifier)
    : onlyDigits(input.identifier);
  const user = input.identifier.includes('@')
    ? await findUserByEmail(identifier)
    : await findUserByCnpj(identifier);

  if (!user) {
    return;
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.RESET_PASSWORD_TOKEN_TTL_MINUTES * 60 * 1000);

  await createPasswordReset({
    createdAt: now,
    expiresAt,
    tokenHash,
    usedAt: null,
    userId: user._id
  });

  const resetUrl = env.RESET_PASSWORD_FRONT_URL
    ? `${env.RESET_PASSWORD_FRONT_URL}${env.RESET_PASSWORD_FRONT_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    : undefined;

  if (env.NODE_ENV !== 'production') {
    logger.warn('password_reset_token_generated', {
      email: user.email,
      expiresAt,
      resetUrl,
      token
    });
    return;
  }

  logger.warn('password_reset_requested_without_smtp', {
    email: user.email,
    message: 'SMTP is not configured. Hide the forgot-password CTA in production or configure email delivery.'
  });
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashPasswordResetToken(input.token);
  const passwordReset = await findValidPasswordReset(tokenHash);

  if (!passwordReset) {
    throw new AppError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(input.password, passwordHashRounds);
  const updatedUser = await updateUserById(passwordReset.userId.toString(), {
    passwordHash,
    updatedAt: new Date()
  });

  if (!updatedUser) {
    throw new AppError(404, 'User not found');
  }

  await markPasswordResetAsUsed(passwordReset._id);
}

function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
