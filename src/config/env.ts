import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Module 1 only defines the env vars this module actually needs.
 * Later modules (Supabase client, Dify/AI integration, etc.) will
 * extend this schema when they're built — not before, so we never
 * validate against variables nothing reads yet.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Comma-separated list of allowed origins, e.g. "http://localhost:5173,https://app.kaya.africa"
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // --- Supabase (used only for JWT verification, not data access) ---
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // --- Prisma / Postgres (data access layer) ---
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Kaya AI Microservice ---
  KAYA_AI_URL: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Intentionally fail fast and loud. A server that boots with bad
    // config is worse than a server that refuses to boot at all.
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
