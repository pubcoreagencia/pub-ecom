import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { env } from '../../config/env';

// Authenticated server client (Forwards access token, respects RLS)
export function createServerClient(accessToken: string): SupabaseClient<Database> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env.public;
  
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`
      } : undefined
    }
  });
}
