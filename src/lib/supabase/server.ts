import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { createNeonClient } from '../neon/compat';

/**
 * Server database client.
 *
 * Render production uses Neon. The local CI fallback retains the existing
 * Supabase authenticated client so the current regression suite remains valid.
 */
export function createServerClient(accessToken: string): SupabaseClient<Database> {
  if (process.env.DATABASE_URL) {
    return createNeonClient(accessToken) as unknown as SupabaseClient<Database>;
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing database configuration.');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
    }
  });
}
