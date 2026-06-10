import { ObjectId } from 'mongodb';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dos repositorios usados pelas rotas LGPD (/me/data-export e DELETE /me)
// e pelo requireAuth (revoked-token). Assim os testes nao exigem um Mongo real.

const userObjectId = new ObjectId();

vi.mock('../src/repositories/revoked-token.repository', () => ({
  ensureRevokedTokenIndexes: vi.fn().mockResolvedValue(undefined),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeToken: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../src/repositories/user.repository', () => ({
  ensureUserIndexes: vi.fn().mockResolvedValue(undefined),
  findUserById: vi.fn(),
  deleteUserById: vi.fn().mockResolvedValue(true)
}));

vi.mock('../src/repositories/document.repository', () => ({
  ensureDocumentIndexes: vi.fn().mockResolvedValue(undefined),
  findDocumentsByUser: vi.fn().mockResolvedValue([]),
  deleteDocumentsByUser: vi.fn().mockResolvedValue(2)
}));

vi.mock('../src/repositories/checklist.repository', () => ({
  ensureChecklistIndexes: vi.fn().mockResolvedValue(undefined),
  findChecklistsByUser: vi.fn().mockResolvedValue([]),
  deleteChecklistsByUser: vi.fn().mockResolvedValue(1)
}));

vi.mock('../src/repositories/alert.repository', () => ({
  ensureAlertIndexes: vi.fn().mockResolvedValue(undefined),
  findAlerts: vi.fn().mockResolvedValue([]),
  deleteAlertsByUser: vi.fn().mockResolvedValue(3)
}));

vi.mock('../src/repositories/password-reset.repository', () => ({
  ensurePasswordResetIndexes: vi.fn().mockResolvedValue(undefined),
  deletePasswordResetsByUser: vi.fn().mockResolvedValue(undefined)
}));

let app: typeof import('../src/app').default;
let signAccessToken: typeof import('../src/services/jwt.service').signAccessToken;
let userRepo: typeof import('../src/repositories/user.repository');
let documentRepo: typeof import('../src/repositories/document.repository');

beforeAll(async () => {
  app = (await import('../src/app')).default;
  signAccessToken = (await import('../src/services/jwt.service')).signAccessToken;
  userRepo = await import('../src/repositories/user.repository');
  documentRepo = await import('../src/repositories/document.repository');
});

function buildToken(): string {
  return signAccessToken({
    acceptedTermsAt: new Date(),
    cnae: '6201500',
    cnpj: '12345678000190',
    createdAt: new Date(),
    email: 'tester@example.com',
    firstName: 'Test',
    id: userObjectId.toHexString(),
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

const userRecord = {
  _id: userObjectId,
  acceptedTermsAt: new Date(),
  cnae: '6201500',
  cnpj: '12345678000190',
  createdAt: new Date(),
  email: 'tester@example.com',
  emailNormalized: 'tester@example.com',
  firstName: 'Test',
  lastName: 'User',
  passwordHash: 'should-never-be-exposed',
  updatedAt: new Date()
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /me/data-export (LGPD: acesso/portabilidade)', () => {
  it('returns 401 without an auth token', async () => {
    const response = await request(app).get('/me/data-export');

    expect(response.status).toBe(401);
  });

  it('returns the user profile without leaking passwordHash', async () => {
    vi.mocked(userRepo.findUserById).mockResolvedValue(userRecord as never);

    const response = await request(app)
      .get('/me/data-export')
      .set('Authorization', `Bearer ${buildToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.profile.email).toBe('tester@example.com');
    expect(JSON.stringify(response.body)).not.toContain('should-never-be-exposed');
    expect(response.body).toHaveProperty('documents');
    expect(response.body).toHaveProperty('checklists');
    expect(response.body).toHaveProperty('alerts');
  });
});

describe('DELETE /me (LGPD: esquecimento)', () => {
  it('returns 401 without an auth token', async () => {
    const response = await request(app).delete('/me');

    expect(response.status).toBe(401);
  });

  it('cascades deletion across collections and returns 200', async () => {
    vi.mocked(userRepo.deleteUserById).mockResolvedValue(true);

    const response = await request(app)
      .delete('/me')
      .set('Authorization', `Bearer ${buildToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/removid/i);
    expect(documentRepo.deleteDocumentsByUser).toHaveBeenCalledTimes(1);
    expect(userRepo.deleteUserById).toHaveBeenCalledTimes(1);
  });
});
