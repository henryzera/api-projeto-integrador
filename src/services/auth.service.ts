import bcrypt from 'bcryptjs';
import type { ObjectId } from 'mongodb';

import { AppError } from '../errors/AppError';
import { toPublicUser } from '../mappers/user.mapper';
import type { PublicUser } from '../models/user.model';
import { revokeToken } from '../repositories/revoked-token.repository';
import { createUser, findUserByCnpj, findUserByEmail, findUserById } from '../repositories/user.repository';
import type { LoginInput, RegisterInput } from '../schemas/auth.schemas';
import { normalizeEmail, onlyDigits } from '../utils/auth.utils';
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
