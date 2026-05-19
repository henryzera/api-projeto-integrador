import { Router } from 'express';

import {
  forgotPasswordController,
  loginController,
  logoutController,
  registerController,
  resetPasswordController
} from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { createRateLimiter } from '../middlewares/rateLimiter';
import { validateRequest } from '../middlewares/validateRequest';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../schemas/auth.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const authLimiter = createRateLimiter({
  limit: 20,
  message: 'Too many authentication attempts. Try again later.',
  windowMs: 15 * 60 * 1000
});

router.post('/register', authLimiter, validateRequest({ body: registerSchema }), asyncHandler(registerController));
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), asyncHandler(loginController));
router.post('/forgot-password', authLimiter, validateRequest({ body: forgotPasswordSchema }), asyncHandler(forgotPasswordController));
router.post('/reset-password', authLimiter, validateRequest({ body: resetPasswordSchema }), asyncHandler(resetPasswordController));
router.post('/logout', requireAuth, asyncHandler(logoutController));

export default router;
