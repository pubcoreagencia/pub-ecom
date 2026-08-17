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
    const { data, error } = await this.db
      .from('store_domains')
      .select('stores(*)')
      .eq('domain', domain)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    // Select embedding returns an array or single object depending on relationship.
    // 'store_domains' -> 'stores' is many-to-one, so stores is a single object (or null).
    return data?.stores as StoreRow | null;
  }
}
