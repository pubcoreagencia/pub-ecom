import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseRepository } from './base';
import type { RequestContext } from '../lib/context/request';
import { AppError } from '../lib/errors/model';

type CartRow = Database['public']['Tables']['carts']['Row'];
type CartItemRow = Database['public']['Tables']['cart_items']['Row'];

export class CartRepository extends BaseRepository {
  private readonly adminDb: SupabaseClient<Database>;

  constructor(db: SupabaseClient<Database>, context: RequestContext, adminDb?: SupabaseClient<Database>) {
    super(db, context);
    this.adminDb = adminDb || db;
  }

  // --- GUEST CART ---

  async resolveGuestCart(storeId: string, tokenHash: string): Promise<CartRow | null> {
    const { data, error } = await this.adminDb
      .from('carts')
      .select('*')
      .eq('store_id', storeId)
      .eq('guest_token_hash', tokenHash)
      .eq('status', 'ACTIVE')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async createGuestCart(storeId: string, tokenHash: string, expiresAt: Date): Promise<CartRow> {
    const { data, error } = await this.adminDb
      .from('carts')
      .insert({
        store_id: storeId,
        guest_token_hash: tokenHash,
        token_expires_at: expiresAt.toISOString(),
        status: 'ACTIVE'
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  // --- AUTH CART ---

  async getAuthCart(storeId: string, customerId: string): Promise<CartRow | null> {
    const { data, error } = await this.adminDb
      .from('carts')
      .select('*')
      .eq('store_id', storeId)
      .eq('customer_id', customerId)
      .eq('status', 'ACTIVE')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async createAuthCart(storeId: string, customerId: string): Promise<CartRow> {
    const { data, error } = await this.adminDb
      .from('carts')
      .insert({
        store_id: storeId,
        customer_id: customerId,
        status: 'ACTIVE'
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  // --- CART ITEMS ---

  async getCartItems(cartId: string): Promise<CartItemRow[]> {
    const { data, error } = await this.adminDb
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartId);

    if (error) throw error;
    return data || [];
  }

  async addCartItem(cartId: string, variantId: string, quantity: number): Promise<void> {
    // Relying on select-then-update to handle "23505 duplicate key" 
    const { data: existing, error: selErr } = await this.adminDb
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('store_product_variant_id', variantId)
      .single();
    
    if (existing) {
      const { error: upErr } = await this.adminDb
        .from('cart_items')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id);
      if (upErr) throw upErr;
      return;
    }

    if (selErr && selErr.code !== 'PGRST116') throw selErr;

    const { error } = await this.adminDb
      .from('cart_items')
      .insert({
        cart_id: cartId,
        store_product_variant_id: variantId,
        quantity
      });

    if (error) {
      if (error.code === '23505') {
         // Race condition handled: just call ourselves recursively to do the update
         return this.addCartItem(cartId, variantId, quantity);
      }
      throw error;
    }
  }

  async updateCartItem(cartId: string, variantId: string, quantity: number): Promise<void> {
    const { error } = await this.adminDb
      .from('cart_items')
      .update({ quantity })
      .eq('cart_id', cartId)
      .eq('store_product_variant_id', variantId);

    if (error) throw error;
  }

  async removeCartItem(cartId: string, variantId: string): Promise<void> {
    const { error } = await this.adminDb
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId)
      .eq('store_product_variant_id', variantId);

    if (error) throw error;
  }

  // --- MERGE ---

  async mergeGuestCart(
    adminClient: SupabaseClient<Database>,
    guestCartId: string,
    guestTokenHash: string,
    customerId: string,
    storeId: string
  ): Promise<string> {
    const { data, error } = await adminClient.rpc('merge_guest_cart', {
      p_guest_cart_id: guestCartId,
      p_guest_token_hash: guestTokenHash,
      p_customer_id: customerId,
      p_store_id: storeId
    });

    if (error) {
      throw error; // Will be mapped by the service
    }
    
    return data;
  }
}
