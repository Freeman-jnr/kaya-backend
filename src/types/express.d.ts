import type { AuthenticatedUser } from '@types/auth';

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
