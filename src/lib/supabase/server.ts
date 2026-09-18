import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { createNeonClient } from '../neon/compat';

/**
 * Server database client. Neon Auth bearer tokens are verified by the
 * compatibility client's auth.getUser() implementation.
 */
export function createServerClient(accessToken: string): SupabaseClient<Database> {
  return createNeonClient(accessToken) as unknown as SupabaseClient<Database>;
}
