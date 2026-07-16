import pino from 'pino';
import { env } from '@config/env';

/**
 * Central logger instance. Every module should import this rather than
 * calling console.log directly, so log level, format, and (later)
 * redaction of secrets are controlled in exactly one place.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'kaya-backend' },
  timestamp: true,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: ['req.headers.authorization', 'password', '*.password', '*.token', '*.apiKey'],
    censor: '[REDACTED]',
  },
});
