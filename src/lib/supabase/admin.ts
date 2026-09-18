import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { createNeonClient } from '../neon/compat';

/**
 * Privileged server database client.
 *
 * Production / Render uses Neon through the compatibility layer.
 * Local CI can still use the existing Supabase test stack when DATABASE_URL
 * is absent, preserving the repository's existing regression harness.
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (process.env.DATABASE_URL) {
    return createNeonClient() as unknown as SupabaseClient<Database>;
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing database configuration.');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}
