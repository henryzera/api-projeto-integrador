import type { ObjectId } from 'mongodb';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      objectId: ObjectId;
      email: string;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
