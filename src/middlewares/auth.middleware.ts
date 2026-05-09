import { NextFunction, Request, Response } from 'express';
import { ObjectId } from 'mongodb';

import { AppError } from '../errors/AppError';
import { isTokenRevoked } from '../repositories/revoked-token.repository';
import { verifyAccessToken } from '../services/jwt.service';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return next(new AppError(401, 'Authentication token is required'));
    }

    const token = authorization.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);

    if (!ObjectId.isValid(payload.sub) || (await isTokenRevoked(payload.jti))) {
      return next(new AppError(401, 'Invalid authentication token'));
    }

    req.user = {
      email: payload.email,
      expiresAt: new Date(payload.exp * 1000),
      id: payload.sub,
      jti: payload.jti,
      objectId: new ObjectId(payload.sub)
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
