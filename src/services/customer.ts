import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseService } from './base';
import type { RequestContext } from '../lib/context/request';
import type { AuthContext } from '../lib/auth/context';
import type { TenantContext } from '../lib/context/tenant';
import { CustomerRepository } from '../repositories/customer';
import { requireAuthenticated, requireOrganizationAccess } from '../lib/authorization/boundary';
import type { AuthorizationBoundary } from '../lib/authorization/boundary';

type CustomerRow = Database['public']['Tables']['customers']['Row'];

export interface CreateCustomerParams {
  email: string;
  document?: string;
  full_name?: string;
}

export interface UpdateCustomerParams {
  email?: string;
  document?: string;
  full_name?: string;
}

export class CustomerService extends BaseService {
  private readonly db: SupabaseClient<Database>;
  private readonly adminDb: SupabaseClient<Database>;
  private readonly repo: CustomerRepository;
  private readonly auth: AuthContext;
  private readonly tenant: TenantContext;

  constructor(
    db: SupabaseClient<Database>, 
    context: RequestContext, 
    auth: AuthContext, 
    tenant: TenantContext,
    adminDb?: SupabaseClient<Database>
  ) {
    super(context);
    this.db = db;
    this.adminDb = adminDb || db;
    this.repo = new CustomerRepository(db, context, adminDb);
    this.auth = auth;
    this.tenant = tenant;
  }

  protected getAuthorizationBoundary(): AuthorizationBoundary {
    return { auth: this.auth, tenant: this.tenant };
  }

  async createCustomer(params: CreateCustomerParams): Promise<CustomerRow> {
    requireAuthenticated(this.getAuthorizationBoundary());
    
    // Explicitly enforce that the user creating the customer has 
    // a bound tenant context in the RequestContext. 
    // (In reality, they are acting as a customer of a Store which belongs to an Org).
    if (!this.context.organizationId) {
      throw new Error('Customer creation requires a resolved organization context');
    }

    requireOrganizationAccess(this.getAuthorizationBoundary(), this.context.organizationId);

    // Repository will enforce that user_id and organization_id come from context
    return await this.repo.createCustomer({
      email: params.email,
      document: params.document || null,
      full_name: params.full_name || null
    });
  }

  async getCurrentCustomer(): Promise<CustomerRow | null> {
    requireAuthenticated(this.getAuthorizationBoundary());
    
    if (!this.context.organizationId) {
      return null;
    }

    requireOrganizationAccess(this.getAuthorizationBoundary(), this.context.organizationId);

    return await this.repo.getCurrentCustomer();
  }

  async updateCurrentCustomer(params: UpdateCustomerParams): Promise<CustomerRow> {
    requireAuthenticated(this.getAuthorizationBoundary());
    
    if (!this.context.organizationId) {
      throw new Error('Customer update requires a resolved organization context');
    }

    requireOrganizationAccess(this.getAuthorizationBoundary(), this.context.organizationId);

    // Get current customer first to check if they exist
    const current = await this.repo.getCurrentCustomer();
    if (!current) {
        throw new Error('Customer profile not found.');
    }

    return await this.repo.updateCurrentCustomer({
      email: params.email !== undefined ? params.email : current.email,
      document: params.document !== undefined ? params.document : current.document,
      full_name: params.full_name !== undefined ? params.full_name : current.full_name
    });
  }
}
