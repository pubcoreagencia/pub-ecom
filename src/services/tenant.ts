import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseService } from './base';
import type { RequestContext } from '../lib/context/request';
import { resolveTenantContext, type TenantContext } from '../lib/context/tenant';
import { TenantRepository } from '../repositories/tenant';
import { AppError } from '../lib/errors/model';
import type { AuthorizationBoundary } from '../lib/authorization/boundary';
import { requireAuthenticated } from '../lib/authorization/boundary';
import type { ResolvedIdentity } from './identity';
import type { AuthContext } from '../lib/auth/context';

export class TenantService extends BaseService {
  private readonly db: SupabaseClient<Database>;
  private readonly repo: TenantRepository;
  private readonly auth: AuthContext;

  constructor(db: SupabaseClient<Database>, context: RequestContext, auth: AuthContext) {
    super(context);
    this.db = db;
    this.repo = new TenantRepository(db, context);
    this.auth = auth;
  }

  protected getAuthorizationBoundary(): AuthorizationBoundary {
    return { auth: this.auth };
  }

  /**
   * Safe organization resolution:
   * Rejects requests if the identity does not have an active membership for the organization.
   */
  async resolveOrganizationContext(
    identity: ResolvedIdentity, 
    requestedOrganizationId: string
  ): Promise<TenantContext> {
    requireAuthenticated(this.getAuthorizationBoundary());

    const membership = identity.memberships.find(m => m.organizationId === requestedOrganizationId);
    
    if (!membership) {
      this.logger.warn('Unauthorized organization traversal attempt', { 
        requestId: this.context.requestId,
        userId: identity.user.id,
        organizationId: requestedOrganizationId
      });
      throw new AppError({
        code: 'TENANT_ACCESS_ERROR',
        publicMessage: 'Access denied for this organization.',
        internalMessage: `User ${identity.user.id} attempted to access org ${requestedOrganizationId} without membership.`,
        httpStatus: 403,
        retryable: false,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId
      });
    }

    const org = await this.repo.getOrganization(requestedOrganizationId);
    if (!org) {
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Organization not found.',
        internalMessage: `Organization ${requestedOrganizationId} mapped in membership but missing in DB.`,
        httpStatus: 404,
        retryable: false,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId
      });
    }

    return resolveTenantContext(org.id, undefined, undefined);
  }

  /**
   * Safe store resolution:
   * Validates that the requested store belongs to an organization where the user has a membership.
   */
  async resolveStoreContext(
    identity: ResolvedIdentity, 
    requestedStoreId: string
  ): Promise<TenantContext> {
    requireAuthenticated(this.getAuthorizationBoundary());

    const store = await this.repo.getStore(requestedStoreId);
    
    if (!store) {
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Store not found.',
        internalMessage: `Store ${requestedStoreId} not found in DB.`,
        httpStatus: 404,
        retryable: false,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId
      });
    }

    const membership = identity.memberships.find(m => m.organizationId === store.organization_id);

    if (!membership) {
      this.logger.warn('Unauthorized store traversal attempt', { 
        requestId: this.context.requestId,
        userId: identity.user.id,
        storeId: requestedStoreId,
        organizationId: store.organization_id
      });
      throw new AppError({
        code: 'TENANT_ACCESS_ERROR',
        publicMessage: 'Access denied for this store.',
        internalMessage: `User ${identity.user.id} attempted to access store ${requestedStoreId} belonging to org ${store.organization_id} without membership.`,
        httpStatus: 403,
        retryable: false,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId
      });
    }

    // Attempt to resolve customer relationship if it exists for this organization
    const customer = identity.customers.find(c => c.organizationId === store.organization_id);

    return resolveTenantContext(store.organization_id, store.id, customer?.customerId);
  }

  /**
   * Public store resolution:
   * Resolves a store context purely from a hostname/domain.
   * Does NOT require authentication.
   */
  async resolveStoreFromDomain(domain: string): Promise<TenantContext> {
    const store = await this.repo.getStoreByDomain(domain);

    if (!store) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Store not found.',
        internalMessage: `No store mapped for domain ${domain}.`,
        httpStatus: 404,
        retryable: false,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId
      });
    }

    if (store.status !== 'ACTIVE') {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Store is not active.',
        internalMessage: `Store ${store.id} on domain ${domain} is ${store.status}.`,
        httpStatus: 403,
        retryable: false,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId
      });
    }

    return resolveTenantContext(store.organization_id, store.id, undefined);
  }
}
