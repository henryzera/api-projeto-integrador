import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../config/env';
import { logger } from '../utils/logger';

// Envio de e-mail plugavel. Se as variaveis SMTP estiverem configuradas
// (SMTP_HOST/PORT/USER/PASS/FROM), criamos um transporter do nodemailer e o
// envio e habilitado. Caso contrario, isEmailEnabled() retorna false e o
// auth.service mantem o fallback (retornar resetToken em dev + log).

let cachedTransporter: Transporter | null = null;

export function isEmailEnabled(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

function getTransporter(): Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    auth: {
      pass: env.SMTP_PASS,
      user: env.SMTP_USER
    },
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465
  });

  return cachedTransporter;
}

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!isEmailEnabled()) {
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      html: input.html,
      subject: input.subject,
      text: input.text,
      to: input.to
    });

    return true;
  } catch (error) {
    logger.error('email_send_failed', { error, subject: input.subject });

    return false;
  }
}

export function buildPasswordResetLink(token: string): string | null {
  if (!env.PASSWORD_RESET_URL_BASE) {
    return null;
  }

  const base = env.PASSWORD_RESET_URL_BASE;
  const separator = base.includes('?') ? '&' : '?';

  return `${base}${separator}token=${encodeURIComponent(token)}`;
}
