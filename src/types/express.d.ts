import type { ObjectId } from 'mongodb';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      email: string;
      expiresAt: Date;
      id: string;
      jti: string;
      objectId: ObjectId;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
