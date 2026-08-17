import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { env } from '../../config/env';

// Privileged server client (uses SERVICE_ROLE key, bypasses RLS)
// MUST NEVER BE EXPOSED TO BROWSER OR GENERIC ROUTES
export function createAdminClient(): SupabaseClient<Database> {
  const { SUPABASE_URL } = env.public;
  const { SUPABASE_SERVICE_ROLE_KEY } = env.server; // Will throw if accessed in browser
  
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}
