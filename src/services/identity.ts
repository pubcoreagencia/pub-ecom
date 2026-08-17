import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseService } from './base';
import type { RequestContext } from '../lib/context/request';
import { createUnauthenticatedContext, createAuthenticatedContext, type AuthContext } from '../lib/auth/context';
import { IdentityRepository } from '../repositories/identity';
import { AppError } from '../lib/errors/model';
import type { AuthorizationBoundary } from '../lib/authorization/boundary';
import { createRoleContext, type ApplicationRole } from '../lib/context/role';

export interface ResolvedIdentity {
  user: Database['public']['Tables']['users']['Row'];
  memberships: Array<{
    organizationId: string;
    role: ApplicationRole;
  }>;
  customers: Array<{
    organizationId: string;
    customerId: string;
  }>;
}

export class IdentityService extends BaseService {
  private readonly db: SupabaseClient<Database>;
  private readonly repo: IdentityRepository;

  constructor(db: SupabaseClient<Database>, context: RequestContext) {
    super(context);
    this.db = db;
    this.repo = new IdentityRepository(db, context);
  }

  // Identity Service itself doesn't require a pre-boundary to resolve who you are.
  protected getAuthorizationBoundary(): AuthorizationBoundary {
    return {
      auth: createUnauthenticatedContext() // Safe default, meaning this service can be called by anyone
    };
  }

  /**
   * Resolves the current session from the Supabase Client into our App AuthContext.
   */
  async resolveSession(): Promise<AuthContext> {
    try {
      const { data: { user }, error } = await this.db.auth.getUser();
      
      if (error) {
        this.logger.warn('Failed to resolve auth session', { requestId: this.context.requestId }, { error });
        return createUnauthenticatedContext();
      }

      if (!user) {
        return createUnauthenticatedContext();
      }

      return createAuthenticatedContext(user.id, {
        accessToken: ''
      });
    } catch (e) {
      this.logger.error('Unexpected error during session resolution', { requestId: this.context.requestId }, { error: e });
      return createUnauthenticatedContext();
    }
  }

  /**
   * Resolves the full domain identity for an authenticated user.
   */
  async resolveIdentity(userId: string): Promise<ResolvedIdentity> {
    try {
      const user = await this.repo.getUser(userId);
      if (!user) {
        throw new AppError({
          code: 'AUTHENTICATION_ERROR',
          publicMessage: 'User profile not found.',
          internalMessage: `User ${userId} not found in public.users`,
          httpStatus: 404,
          retryable: false,
          requestId: this.context.requestId,
          correlationId: this.context.correlationId
        });
      }

      const membershipsRow = await this.repo.getMemberships(userId);
      const customersRow = await this.repo.getCustomers(userId);

      const memberships = membershipsRow
        .filter(m => m.organization_id && m.role)
        .map(m => ({
          organizationId: m.organization_id!,
          role: m.role as ApplicationRole
        }));

      const customers = customersRow
        .filter(c => c.organization_id)
        .map(c => ({
          organizationId: c.organization_id!,
          customerId: c.id
        }));

      return {
        user,
        memberships,
        customers
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      this.logger.error('Database error resolving identity', { requestId: this.context.requestId }, { error });
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Failed to retrieve identity details.',
        internalMessage: 'Unexpected database error resolving identity',
        httpStatus: 500,
        retryable: true,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId,
        cause: error
      });
    }
  }
}
