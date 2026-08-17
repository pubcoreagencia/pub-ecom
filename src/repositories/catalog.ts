import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseRepository } from './base';
import type { RequestContext } from '../lib/context/request';

type MasterProductRow = Database['public']['Tables']['master_products']['Row'];
type MasterVariantRow = Database['public']['Tables']['master_product_variants']['Row'];
type StoreProductRow = Database['public']['Tables']['store_products']['Row'];
type StoreVariantRow = Database['public']['Tables']['store_product_variants']['Row'];
type MasterInventoryRow = Database['public']['Tables']['master_inventory']['Row'];

export class CatalogRepository extends BaseRepository {
  constructor(db: SupabaseClient<Database>, context: RequestContext) {
    super(db, context);
  }

  async getMasterProduct(masterProductId: string): Promise<MasterProductRow | null> {
    const { data, error } = await this.db
      .from('master_products')
      .select('*')
      .eq('id', masterProductId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getMasterVariants(masterProductId: string): Promise<MasterVariantRow[]> {
    const { data, error } = await this.db
      .from('master_product_variants')
      .select('*')
      .eq('master_product_id', masterProductId);

    if (error) throw error;
    return data || [];
  }

  async getStoreProducts(storeId: string): Promise<StoreProductRow[]> {
    const { data, error } = await this.db
      .from('store_products')
      .select('*')
      .eq('store_id', storeId)
      .is('deleted_at', null);

    if (error) throw error;
    return data || [];
  }

  async getStoreProductDetail(storeProductId: string, storeId: string): Promise<{ product: StoreProductRow, variants: StoreVariantRow[] } | null> {
    const { data: product, error: productError } = await this.db
      .from('store_products')
      .select('*')
      .eq('id', storeProductId)
      .eq('store_id', storeId)
      .is('deleted_at', null)
      .single();

    if (productError) {
      if (productError.code === 'PGRST116') return null;
      throw productError;
    }

    const { data: variants, error: variantError } = await this.db
      .from('store_product_variants')
      .select('*')
      .eq('store_product_id', storeProductId);

    if (variantError) throw variantError;

    return { product, variants: variants || [] };
  }

  async getStoreVariantDetail(variantId: string): Promise<{ variant: StoreVariantRow, product: StoreProductRow } | null> {
    const { data, error } = await this.db
      .from('store_product_variants')
      .select('*, store_products(*)')
      .eq('id', variantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    if (!data.store_products) return null;

    // Type casting since Supabase select with nested joins returns an array or object type that needs inference
    const product = Array.isArray(data.store_products) ? data.store_products[0] : data.store_products;
    
    // Omit the joined relation from the variant result
    const { store_products, ...variant } = data as any;
    
    return { variant: variant as StoreVariantRow, product: product as StoreProductRow };
  }

  async getInventory(masterVariantIds: string[]): Promise<MasterInventoryRow[]> {
    if (masterVariantIds.length === 0) return [];
    
    // We expect master_variant_id to be populated.
    const { data, error } = await this.db
      .from('master_inventory')
      .select('*')
      .in('master_variant_id', masterVariantIds);

    if (error) throw error;
    return data || [];
  }
}
