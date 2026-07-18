import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '@config/env';

/**
 * Allowed origins are read from CORS_ORIGIN (comma-separated).
 * Kept strict on purpose — Kaya handles financial data, so we don't
 * default to "*".
 */
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser tools (curl, server-to-server, Postman) which send no origin.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Return null/false — do NOT pass an Error, which would cause a 500.
      // The cors package will respond with no Access-Control-Allow-Origin header,
      // causing the browser to block the request with a standard CORS error.
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
