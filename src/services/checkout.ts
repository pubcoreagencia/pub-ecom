import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseService } from './base';
import type { RequestContext } from '../lib/context/request';
import type { TenantContext } from '../lib/context/tenant';
import type { AuthContext } from '../lib/auth/context';
import { AppError } from '../lib/errors/model';

export class CheckoutService extends BaseService {
  private readonly db: SupabaseClient<Database>;
  private readonly tenant: TenantContext;
  private readonly auth: AuthContext;

  constructor(db: SupabaseClient<Database>, context: RequestContext, auth: AuthContext, tenant: TenantContext) {
    super(context);
    this.db = db;
    this.tenant = tenant;
    this.auth = auth;
  }

  protected getAuthorizationBoundary() {
    return { auth: this.auth, tenant: this.tenant };
  }

  async createCheckout(cartId: string, guestTokenHash?: string): Promise<{ checkoutId: string }> {
    if (!this.tenant.isResolved || !this.tenant.storeId) {
      throw new AppError({
        code: 'TENANT_ACCESS_ERROR',
        publicMessage: 'Invalid store context.',
        internalMessage: 'Checkout requires a resolved store context.',
        httpStatus: 403,
        retryable: false,
        requestId: this.context.requestId
      });
    }

    const customerId = this.auth.state === 'AUTHENTICATED' ? this.auth.userId! : null;

    const { data, error } = await this.db.rpc('create_checkout', {
      p_cart_id: cartId,
      p_store_id: this.tenant.storeId,
      p_customer_id: customerId as any,
      p_guest_token_hash: (guestTokenHash || null) as any
    });

    if (error) {
      throw this.mapCheckoutError(error);
    }

    if (!data) {
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Failed to create checkout.',
        internalMessage: 'create_checkout returned null checkoutId',
        httpStatus: 500,
        retryable: true,
        requestId: this.context.requestId
      });
    }

    return { checkoutId: data };
  }

  private mapCheckoutError(error: any): AppError {
    const msg = error.message || '';

    if (msg.includes('store_mismatch')) {
      return new AppError({ code: 'TENANT_ACCESS_ERROR', publicMessage: 'Store mismatch.', internalMessage: msg, httpStatus: 403, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('unauthorized_cart')) {
      return new AppError({ code: 'AUTHORIZATION_ERROR', publicMessage: 'Unauthorized cart access.', internalMessage: msg, httpStatus: 401, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('cart_not_found')) {
      return new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Cart not found.', internalMessage: msg, httpStatus: 404, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('active_checkout_exists')) {
      return new AppError({ code: 'CONFLICT', publicMessage: 'An active checkout already exists for this cart.', internalMessage: msg, httpStatus: 409, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('cart_not_active')) {
      return new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Cart is not active.', internalMessage: msg, httpStatus: 400, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('invalid_guest_token')) {
      return new AppError({ code: 'AUTHENTICATION_ERROR', publicMessage: 'Invalid guest session.', internalMessage: msg, httpStatus: 401, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('expired_guest_cart')) {
      return new AppError({ code: 'AUTHENTICATION_ERROR', publicMessage: 'Guest session expired.', internalMessage: msg, httpStatus: 401, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('empty_cart')) {
      return new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Cart is empty.', internalMessage: msg, httpStatus: 400, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('unavailable_variant')) {
      return new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'One or more items in your cart are no longer available.', internalMessage: msg, httpStatus: 400, retryable: false, requestId: this.context.requestId, cause: error });
    }
    if (msg.includes('insufficient_stock')) {
      return new AppError({ code: 'CONFLICT', publicMessage: 'Insufficient stock for one or more items in your cart.', internalMessage: msg, httpStatus: 409, retryable: false, requestId: this.context.requestId, cause: error });
    }

    // Default unhandled error
    this.logger.error('Unhandled Checkout RPC Error', { requestId: this.context.requestId }, { error });
    return new AppError({
      code: 'INTERNAL_ERROR',
      publicMessage: 'An unexpected error occurred during checkout.',
      internalMessage: 'Unhandled RPC exception: ' + msg,
      httpStatus: 500,
      retryable: true,
      requestId: this.context.requestId,
      cause: error
    });
  }
}
