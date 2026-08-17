import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { env } from '../../config/env';

// Public browser client (uses ANON key)
export function createBrowserClient(): SupabaseClient<Database> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env.public;
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
