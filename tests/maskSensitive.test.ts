import { describe, expect, it } from 'vitest';

import {
  maskDocument,
  maskEmail,
  maskSensitiveMeta,
  maskToken
} from '../src/utils/maskSensitive';

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('joao.silva@empresa.com')).toBe('j***@empresa.com');
  });

  it('falls back to generic masking without an @', () => {
    expect(maskEmail('semarroba')).toBe('s***');
  });
});

describe('maskDocument', () => {
  it('keeps only the last two digits of a CNPJ', () => {
    expect(maskDocument('12345678000190')).toBe('************90');
  });
});

describe('maskToken', () => {
  it('keeps a short prefix for correlation', () => {
    expect(maskToken('a1b2c3d4e5f6')).toBe('a1b2****');
  });
});

describe('maskSensitiveMeta', () => {
  it('masks sensitive keys recursively and leaves others intact', () => {
    const result = maskSensitiveMeta({
      email: 'user@example.com',
      cnpj: '12345678000190',
      resetToken: 'abcdef123456',
      passwordHash: 'secret-hash-value',
      nested: { authorization: 'Bearer xyztoken', durationMs: 12 },
      durationMs: 42
    }) as Record<string, unknown>;

    expect(result.email).toBe('u***@example.com');
    expect(result.cnpj).toBe('************90');
    expect(result.resetToken).toBe('abcd****');
    expect(result.passwordHash).toBe('secr****');
    expect((result.nested as Record<string, unknown>).authorization).toBe('Bear****');
    expect((result.nested as Record<string, unknown>).durationMs).toBe(12);
    expect(result.durationMs).toBe(42);
  });

  it('preserves Error objects untouched', () => {
    const error = new Error('boom');

    expect(maskSensitiveMeta({ error }).error).toBe(error);
  });
});
