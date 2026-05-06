import { Router } from 'express';

import { loginController, registerController } from '../controllers/auth.controller';
import { createRateLimiter } from '../middlewares/rateLimiter';
import { validateRequest } from '../middlewares/validateRequest';
import { loginSchema, registerSchema } from '../schemas/auth.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const authLimiter = createRateLimiter({
  limit: 20,
  message: 'Too many authentication attempts. Try again later.',
  windowMs: 15 * 60 * 1000
});

router.post('/register', authLimiter, validateRequest({ body: registerSchema }), asyncHandler(registerController));
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), asyncHandler(loginController));

export default router;
