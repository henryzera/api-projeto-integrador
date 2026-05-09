import { Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import { loginUser, getCurrentUser, logoutUser, registerUser } from '../services/auth.service';

export async function registerController(req: Request, res: Response) {
  const auth = await registerUser(req.body);

  return res.status(201).json(auth);
}

export async function loginController(req: Request, res: Response) {
  const auth = await loginUser(req.body);

  return res.status(200).json(auth);
}

export async function meController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const user = await getCurrentUser(req.user.id);

  return res.status(200).json({ user });
}

export async function logoutController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  await logoutUser({
    expiresAt: req.user.expiresAt,
    jti: req.user.jti,
    userId: req.user.objectId
  });

  return res.status(204).send();
}
