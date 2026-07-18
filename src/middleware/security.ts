import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '@config/env';
import { logger } from '@config/logger';

/**
 * Allowed origins are read from CORS_ORIGIN (comma-separated).
 * Kept strict on purpose — Kaya handles financial data, so we don't
 * default to "*".
 */
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim().replace(/\/$/, ''));

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser tools (curl, server-to-server, Postman) which send no origin.
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.trim().replace(/\/$/, '');
    const isAllowed = allowedOrigins.includes(cleanOrigin);

    if (isAllowed) {
      callback(null, true);
    } else {
      // Log the rejection so it's visible in Render logs for easy debugging
      logger.warn(
        { origin, cleanOrigin, allowedOrigins },
        'CORS request rejected'
      );
      callback(null, false);
    }
  },
  credentials: true,
});

export const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

export const rateLimitMiddleware = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    errors: [],
  },
});
