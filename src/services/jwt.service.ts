import { randomUUID } from 'crypto';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import type { PublicUser } from '../models/user.model';

type AuthTokenPayload = JwtPayload & {
  cnae?: string;
  email: string;
  exp: number;
  jti: string;
  sub: string;
};

export function signAccessToken(user: PublicUser): string {
  const options: SignOptions = {
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: env.JWT_ISSUER,
    jwtid: randomUUID(),
    subject: user.id
  };

  return jwt.sign({ cnae: user.cnae, email: user.email }, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER
    });

    if (
      typeof decoded === 'string' ||
      typeof decoded.exp !== 'number' ||
      typeof decoded.jti !== 'string' ||
      typeof decoded.sub !== 'string'
    ) {
      throw new AppError(401, 'Invalid authentication token');
    }

    return decoded as AuthTokenPayload;
  } catch {
    throw new AppError(401, 'Invalid authentication token');
  }
}
