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

// Rate limit MAIS ESTRITO especifico para /login, como reforco anti-forca-bruta
// (Requisito 1). Permite ate 10 tentativas a cada 5 minutos por IP. Optamos por
// um limiter dedicado (simples, sem estado em banco) em vez de bloqueio por
// conta numa colecao TTL, evitando uma dependencia de DB no caminho de login e
// mantendo os testes deterministicos. A blacklist de tokens (logout) e o reset
// de senha continuam cobrindo os demais cenarios.
const loginLimiter = createRateLimiter({
  limit: 10,
  message: 'Too many login attempts. Please wait a few minutes and try again.',
  windowMs: 5 * 60 * 1000
});

router.post('/register', authLimiter, validateRequest({ body: registerSchema }), asyncHandler(registerController));
router.post('/login', loginLimiter, authLimiter, validateRequest({ body: loginSchema }), asyncHandler(loginController));
router.post(
  '/forgot-password',
  authLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  asyncHandler(forgotPasswordController)
);
router.post(
  '/reset-password',
  authLimiter,
  validateRequest({ body: resetPasswordSchema }),
  asyncHandler(resetPasswordController)
);
router.post('/logout', requireAuth, asyncHandler(logoutController));

export default router;
