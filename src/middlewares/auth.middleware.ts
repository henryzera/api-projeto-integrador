import { NextFunction, Request, Response } from 'express';
import { ObjectId } from 'mongodb';

import { AppError } from '../errors/AppError';
import { verifyAccessToken } from '../services/jwt.service';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Authentication token is required'));
  }

  const token = authorization.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);

  if (!ObjectId.isValid(payload.sub)) {
    return next(new AppError(401, 'Invalid authentication token'));
  }

  req.user = {
    email: payload.email,
    id: payload.sub,
    objectId: new ObjectId(payload.sub)
  };

  return next();
}
