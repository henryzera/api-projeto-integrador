import { ObjectId } from 'mongodb';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Mock do Mongo: a rota /contratacoes passa por requireAuth, que consulta a
// colecao de tokens revogados. Mockamos para nao exigir DB real nos testes.
vi.mock('../src/repositories/revoked-token.repository', () => ({
  ensureRevokedTokenIndexes: vi.fn().mockResolvedValue(undefined),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeToken: vi.fn().mockResolvedValue(undefined)
}));

let app: typeof import('../src/app').default;
let signAccessToken: typeof import('../src/services/jwt.service').signAccessToken;

beforeAll(async () => {
  app = (await import('../src/app')).default;
  signAccessToken = (await import('../src/services/jwt.service')).signAccessToken;
});

function buildToken(): string {
  return signAccessToken({
    cnae: '6201500',
    cnpj: '12345678000190',
    createdAt: new Date(),
    email: 'tester@example.com',
    firstName: 'Test',
    id: new ObjectId().toHexString(),
    lastName: 'User',
    notificationPreferences: {
      daysBeforeDeadline: 3,
      documentAlerts: true,
      email: true,
      proposalAlerts: true,
      push: true
    },
    updatedAt: new Date()
  });
}

describe('GET /contratacoes/:id validation', () => {
  it('returns 401 without an auth token', async () => {
    const response = await request(app).get('/contratacoes/507f1f77bcf86cd799439011');

    expect(response.status).toBe(401);
  });

  it('returns 400 for an invalid ObjectId (not 500)', async () => {
    const response = await request(app)
      .get('/contratacoes/not-a-valid-id')
      .set('Authorization', `Bearer ${buildToken()}`);

    expect(response.status).toBe(400);
  });

  it('returns 400 for a too-short id', async () => {
    const response = await request(app)
      .get('/contratacoes/123')
      .set('Authorization', `Bearer ${buildToken()}`);

    expect(response.status).toBe(400);
  });
});
