import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseRepository } from './base';
import type { RequestContext } from '../lib/context/request';
import { AppError } from '../lib/errors/model';

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Omit<Database['public']['Tables']['customers']['Insert'], 'id' | 'created_at' | 'deleted_at' | 'organization_id' | 'user_id'>;
type CustomerUpdate = Omit<Database['public']['Tables']['customers']['Update'], 'id' | 'created_at' | 'deleted_at' | 'organization_id' | 'user_id'>;

export class CustomerRepository extends BaseRepository {
  private readonly adminDb: SupabaseClient<Database>;

  constructor(db: SupabaseClient<Database>, context: RequestContext, adminDb?: SupabaseClient<Database>) {
    super(db, context);
    this.adminDb = adminDb || db;
  }

  async createCustomer(params: CustomerInsert): Promise<CustomerRow> {
    if (!this.context.organizationId) {
       throw new Error('Organization context is missing');
    }
    
    if (!this.context.userId) {
       throw new Error('User context is missing');
    }

    const { data, error } = await this.adminDb
      .from('customers')
      .insert({
        organization_id: this.context.organizationId,
        user_id: this.context.userId,
        email: params.email,
        document: params.document,
        full_name: params.full_name
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError({
          code: 'CONFLICT',
          publicMessage: 'You are already registered as a customer in this store.',
          internalMessage: `Duplicate customer for user_id ${this.context.userId} in org ${this.context.organizationId}`,
          httpStatus: 409,
          retryable: false,
          requestId: this.context.requestId,
          correlationId: this.context.correlationId
        });
      }
      throw error;
    }

    return data;
  }

  async getCurrentCustomer(): Promise<CustomerRow | null> {
    if (!this.context.organizationId || !this.context.userId) {
      return null;
    }

    const { data, error } = await this.db
      .from('customers')
      .select('*')
      .eq('organization_id', this.context.organizationId)
      .eq('user_id', this.context.userId)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  async updateCurrentCustomer(params: CustomerUpdate): Promise<CustomerRow> {
    if (!this.context.organizationId || !this.context.userId) {
      throw new Error('Context is missing');
    }

    const { data, error } = await this.db
      .from('customers')
      .update({
        email: params.email,
        document: params.document,
        full_name: params.full_name
      })
      .eq('organization_id', this.context.organizationId)
      .eq('user_id', this.context.userId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
       if (error.code === 'PGRST116') {
          throw new AppError({
             code: 'VALIDATION_ERROR',
             publicMessage: 'Customer profile not found.',
             internalMessage: `Cannot update non-existent customer profile for user_id ${this.context.userId}`,
             httpStatus: 404,
             retryable: false,
             requestId: this.context.requestId,
             correlationId: this.context.correlationId
          });
       }
       throw error;
    }

    return data;
  }
}
