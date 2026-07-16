import { PrismaClient } from '@prisma/client';
import { env } from '@config/env';

/**
 * Prisma client singleton.
 *
 * ts-node-dev hot-reloads on every file change, which would otherwise
 * create a new PrismaClient (and a new DB connection pool) per reload
 * in development, quickly exhausting Postgres connections. Caching the
 * instance on `global` survives module reloads and avoids that.
 *
 * In production this global is only ever set once, so the caching is
 * a no-op there — it's purely a dev-mode safeguard.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}
