import { Request, Response } from 'express';

import { loginUser, getCurrentUser, registerUser } from '../services/auth.service';

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
    return res.status(401).json({ message: 'Authentication token is required' });
  }

  const user = await getCurrentUser(req.user.id);

  return res.status(200).json({ user });
}
