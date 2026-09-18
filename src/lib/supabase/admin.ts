import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { createNeonClient } from '../neon/compat';

/**
 * Server-side privileged database client.
 *
 * The application layer keeps the existing SupabaseClient contract while
 * Neon/Postgres becomes the actual persistence layer. Authorization is still
 * enforced by the service/tenant boundaries already present in the API.
 */
export function createAdminClient(): SupabaseClient<Database> {
  return createNeonClient() as unknown as SupabaseClient<Database>;
}
