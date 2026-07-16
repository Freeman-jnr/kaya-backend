import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@config/env';

/**
 * Server-side Supabase client, used for exactly one purpose:
 * verifying access tokens issued by the frontend's Supabase Auth
 * session (`supabase.auth.getUser(token)` in Module 5's authenticate
 * middleware).
 *
 * This is NOT the data access layer. Business, Customer, Order, etc.
 * data goes through Prisma (see integrations/prisma/client.ts).
 * Mixing the two would give us two different sources of truth for
 * the same data and no clear ownership boundary.
 *
 * Uses the SERVICE ROLE key because verifying an arbitrary user's
 * token from the backend is an admin-level operation — this key must
 * never be sent to the frontend or logged.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
