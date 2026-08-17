import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseRepository } from './base';
import type { RequestContext } from '../lib/context/request';

type UserRow = Database['public']['Tables']['users']['Row'];
type MembershipRow = Database['public']['Tables']['memberships']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];

export class IdentityRepository extends BaseRepository {
  constructor(db: SupabaseClient<Database>, context: RequestContext) {
    super(db, context);
  }

  async getUser(userId: string): Promise<UserRow | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error; // Let service handle wrapping
    }

    return data;
  }

  async getMemberships(userId: string): Promise<MembershipRow[]> {
    const { data, error } = await this.db
      .from('memberships')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  async getCustomers(userId: string): Promise<CustomerRow[]> {
    const { data, error } = await this.db
      .from('customers')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return data || [];
  }
}
