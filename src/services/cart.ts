import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseService } from './base';
import type { RequestContext } from '../lib/context/request';
import type { AuthContext } from '../lib/auth/context';
import type { TenantContext } from '../lib/context/tenant';
import { CartRepository } from '../repositories/cart';
import { CatalogRepository } from '../repositories/catalog';
import { AppError } from '../lib/errors/model';
import { requireAuthenticated } from '../lib/authorization/boundary';
import type { AuthorizationBoundary } from '../lib/authorization/boundary';

type CartRow = Database['public']['Tables']['carts']['Row'];

export interface AddItemParams {
  variantId: string;
  quantity: number;
}

export interface UpdateItemParams {
  variantId: string;
  quantity: number;
}

export class CartService extends BaseService {
  private readonly db: SupabaseClient<Database>;
  private readonly repo: CartRepository;
  private readonly catalogRepo: CatalogRepository;
  private readonly auth: AuthContext;
  private readonly tenant: TenantContext;
  private readonly adminClient: SupabaseClient<Database>; // Explicitly supplied for merge

  constructor(
    db: SupabaseClient<Database>, 
    context: RequestContext, 
    auth: AuthContext, 
    tenant: TenantContext,
    adminClient: SupabaseClient<Database>
  ) {
    super(context);
    this.db = db;
    this.repo = new CartRepository(db, context, adminClient);
    this.catalogRepo = new CatalogRepository(adminClient, context);
    this.auth = auth;
    this.tenant = tenant;
    this.adminClient = adminClient;
  }

  protected getAuthorizationBoundary(): AuthorizationBoundary {
    return { auth: this.auth, tenant: this.tenant };
  }

  private async validateVariant(variantId: string): Promise<void> {
    if (!this.context.storeId) {
      throw new Error('Store context is missing');
    }

    const detail = await this.catalogRepo.getStoreVariantDetail(variantId);
    
    if (!detail) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Product not found.',
        internalMessage: `Variant ${variantId} does not exist.`,
        httpStatus: 404,
        retryable: false
      });
    }

    if (detail.product.store_id !== this.context.storeId) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Product not found.',
        internalMessage: `Variant ${variantId} belongs to a different store.`,
        httpStatus: 404, // Hide cross-store existence
        retryable: false
      });
    }

    if (!detail.variant.is_active || detail.product.status !== 'PUBLISHED') {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Product is not available.',
        internalMessage: `Variant ${variantId} or product ${detail.product.id} is inactive/unpublished.`,
        httpStatus: 400,
        retryable: false
      });
    }
  }

  // --- GUEST CART ---

  async createGuestCart(): Promise<{ cartId: string, rawToken: string }> {
    if (!this.context.storeId) throw new Error('Store context missing');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    const cart = await this.repo.createGuestCart(this.context.storeId, tokenHash, expiresAt);

    return {
      cartId: cart.id,
      rawToken: rawToken
    };
  }

  async resolveGuestCart(rawToken: string): Promise<CartRow | null> {
    if (!this.context.storeId) throw new Error('Store context missing');
    
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return await this.repo.resolveGuestCart(this.context.storeId, tokenHash);
  }

  async addGuestItem(rawToken: string, params: AddItemParams): Promise<void> {
    if (params.quantity <= 0) throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Invalid quantity', internalMessage: 'Quantity must be > 0', httpStatus: 400, retryable: false });
    
    const cart = await this.resolveGuestCart(rawToken);
    if (!cart) {
      throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Invalid guest cart.', internalMessage: 'Cart missing or expired', httpStatus: 404, retryable: false });
    }

    await this.validateVariant(params.variantId);
    await this.repo.addCartItem(cart.id, params.variantId, params.quantity);
  }

  async updateGuestItem(rawToken: string, params: UpdateItemParams): Promise<void> {
    if (params.quantity < 0) throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Invalid quantity', internalMessage: 'Quantity must be >= 0', httpStatus: 400, retryable: false });
    
    const cart = await this.resolveGuestCart(rawToken);
    if (!cart) {
      throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Invalid guest cart.', internalMessage: 'Cart missing or expired', httpStatus: 404, retryable: false });
    }

    if (params.quantity === 0) {
      await this.repo.removeCartItem(cart.id, params.variantId);
    } else {
      await this.repo.updateCartItem(cart.id, params.variantId, params.quantity);
    }
  }

  async removeGuestItem(rawToken: string, variantId: string): Promise<void> {
    const cart = await this.resolveGuestCart(rawToken);
    if (!cart) {
      throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Invalid guest cart.', internalMessage: 'Cart missing or expired', httpStatus: 404, retryable: false });
    }
    
    await this.repo.removeCartItem(cart.id, variantId);
  }

  // --- AUTH CART ---

  async getAuthCart(): Promise<CartRow | null> {
    requireAuthenticated(this.getAuthorizationBoundary());
    if (!this.context.storeId || !this.context.customerId) return null;
    return await this.repo.getAuthCart(this.context.storeId, this.context.customerId);
  }

  async addAuthItem(params: AddItemParams): Promise<void> {
    requireAuthenticated(this.getAuthorizationBoundary());
    if (!this.context.storeId || !this.context.customerId) throw new Error('Context missing');
    if (params.quantity <= 0) throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Invalid quantity', internalMessage: 'Quantity must be > 0', httpStatus: 400, retryable: false });

    await this.validateVariant(params.variantId);

    let cart = await this.repo.getAuthCart(this.context.storeId, this.context.customerId);
    if (!cart) {
      cart = await this.repo.createAuthCart(this.context.storeId, this.context.customerId);
    }

    await this.repo.addCartItem(cart.id, params.variantId, params.quantity);
  }

  async updateAuthItem(params: UpdateItemParams): Promise<void> {
    requireAuthenticated(this.getAuthorizationBoundary());
    if (!this.context.storeId || !this.context.customerId) throw new Error('Context missing');
    if (params.quantity < 0) throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Invalid quantity', internalMessage: 'Quantity must be >= 0', httpStatus: 400, retryable: false });

    const cart = await this.repo.getAuthCart(this.context.storeId, this.context.customerId);
    if (!cart) return;

    if (params.quantity === 0) {
      await this.repo.removeCartItem(cart.id, params.variantId);
    } else {
      await this.repo.updateCartItem(cart.id, params.variantId, params.quantity);
    }
  }

  async removeAuthItem(variantId: string): Promise<void> {
    requireAuthenticated(this.getAuthorizationBoundary());
    if (!this.context.storeId || !this.context.customerId) throw new Error('Context missing');
    
    const cart = await this.repo.getAuthCart(this.context.storeId, this.context.customerId);
    if (!cart) return;

    await this.repo.removeCartItem(cart.id, variantId);
  }

  // --- MERGE ---

  async mergeGuestCart(guestCartId: string, rawGuestToken: string): Promise<string> {
    requireAuthenticated(this.getAuthorizationBoundary());
    if (!this.context.storeId || !this.context.customerId) throw new Error('Context missing');

    const guestTokenHash = crypto.createHash('sha256').update(rawGuestToken).digest('hex');

    try {
      return await this.repo.mergeGuestCart(
        this.adminClient,
        guestCartId,
        guestTokenHash,
        this.context.customerId,
        this.context.storeId
      );
    } catch (error: any) {
      // Map RPC errors to AppError
      const msg = error.message || '';
      
      switch (msg) {
        case 'unauthorized_customer':
        case 'invalid_customer':
        case 'invalid_store':
        case 'store_mismatch':
        case 'guest_cart_consumed':
        case 'invalid_cart_state':
        case 'invalid_guest_token':
        case 'expired_guest_cart':
           throw new AppError({
             code: 'VALIDATION_ERROR',
             publicMessage: 'Cannot merge guest cart.',
             internalMessage: `RPC Error: ${msg}`,
             httpStatus: 400,
             retryable: false
           });
        default:
           throw error;
      }
    }
  }
}
