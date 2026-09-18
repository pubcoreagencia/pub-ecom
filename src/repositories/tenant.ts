import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseRepository } from './base';
import type { RequestContext } from '../lib/context/request';

type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
type StoreRow = Database['public']['Tables']['stores']['Row'];

export class TenantRepository extends BaseRepository {
  constructor(db: SupabaseClient<Database>, context: RequestContext) {
    super(db, context);
  }

  async getOrganization(organizationId: string): Promise<OrganizationRow | null> {
    const { data, error } = await this.db
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data;
  }

  async getStore(storeId: string): Promise<StoreRow | null> {
    const { data, error } = await this.db
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data;
  }

  async getStoreByDomain(domain: string): Promise<StoreRow | null> {
    const { data: domainRow, error: domainError } = await this.db
      .from('store_domains')
      .select('store_id')
      .eq('domain', domain)
      .single();

    if (domainError) {
      if (domainError.code === 'PGRST116') return null;
      throw domainError;
    }

    const { data: store, error: storeError } = await this.db
      .from('stores')
      .select('*')
      .eq('id', domainRow.store_id)
      .single();

    if (storeError) {
      if (storeError.code === 'PGRST116') return null;
      throw storeError;
    }

    return store;
  }
}
