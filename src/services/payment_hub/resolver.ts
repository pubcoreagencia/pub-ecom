import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../types/supabase';
import { AppError } from '../../lib/errors/model';

export interface ResolveConnectionParams {
  storeId?: string;
  organizationId?: string;
  providerId: string;
  environment?: 'SANDBOX' | 'PRODUCTION';
}

export class ConnectionResolver {
  constructor(private db: SupabaseClient<Database>) {}

  public async resolve(params: ResolveConnectionParams) {
    const rawEnv = process.env.APP_ENVIRONMENT;
    if (!rawEnv || (rawEnv !== 'SANDBOX' && rawEnv !== 'PRODUCTION')) {
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Payment environment is misconfigured.',
        internalMessage: `INVALID_APP_ENVIRONMENT: APP_ENVIRONMENT must be set to 'SANDBOX' or 'PRODUCTION' (got: '${rawEnv}')`,
        httpStatus: 500,
        retryable: false
      });
    }
    const env: 'SANDBOX' | 'PRODUCTION' = rawEnv;

    // 1. Check provider catalog status
    const { data: provider, error: provErr } = await this.db
      .from('gateway_providers')
      .select('id, is_active, display_name')
      .eq('id', params.providerId)
      .single();

    if (provErr || !provider || !provider.is_active) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Payment provider is not available.',
        internalMessage: `PROVIDER_NOT_AVAILABLE: Provider ${params.providerId} is inactive or not found`,
        httpStatus: 400,
        retryable: false
      });
    }

    // 2. Store Override (if storeId and organizationId are provided)
    if (params.storeId && params.organizationId) {
      const { data: storeConn } = await this.db
        .from('gateway_connections')
        .select('*')
        .eq('store_id', params.storeId)
        .eq('organization_id', params.organizationId)
        .eq('provider_id', params.providerId)
        .eq('environment', env)
        .maybeSingle();

      if (storeConn) {
        if (storeConn.status === 'SUSPENDED') {
          throw new AppError({
            code: 'PAYMENT_ERROR',
            publicMessage: 'Payment connection is currently suspended.',
            internalMessage: `GATEWAY_CONNECTION_SUSPENDED: Store connection ${storeConn.id} is suspended`,
            httpStatus: 503,
            retryable: true
          });
        }
        if (storeConn.status === 'ACTIVE') {
          return storeConn;
        }
      }
    }

    // 3. Organization Default (if organizationId provided)
    if (params.organizationId) {
      const { data: orgConn } = await this.db
        .from('gateway_connections')
        .select('*')
        .eq('organization_id', params.organizationId)
        .is('store_id', null)
        .eq('provider_id', params.providerId)
        .eq('environment', env)
        .maybeSingle();

      if (orgConn) {
        if (orgConn.status === 'SUSPENDED') {
          throw new AppError({
            code: 'PAYMENT_ERROR',
            publicMessage: 'Payment connection is currently suspended.',
            internalMessage: `GATEWAY_CONNECTION_SUSPENDED: Organization connection ${orgConn.id} is suspended`,
            httpStatus: 503,
            retryable: true
          });
        }
        if (orgConn.status === 'ACTIVE') {
          return orgConn;
        }
      }
    }

    // 4. Global Default Connection
    const { data: globalConn } = await this.db
      .from('gateway_connections')
      .select('*')
      .eq('is_global_default', true)
      .eq('provider_id', params.providerId)
      .eq('environment', env)
      .maybeSingle();

    if (globalConn) {
      if (globalConn.status === 'SUSPENDED') {
        throw new AppError({
          code: 'PAYMENT_ERROR',
          publicMessage: 'Payment connection is currently suspended.',
          internalMessage: `GATEWAY_CONNECTION_SUSPENDED: Global connection ${globalConn.id} is suspended`,
          httpStatus: 503,
          retryable: true
        });
      }
      if (globalConn.status === 'ACTIVE') {
        return globalConn;
      }
    }

    throw new AppError({
      code: 'VALIDATION_ERROR',
      publicMessage: 'Payment method not configured.',
      internalMessage: `GATEWAY_NOT_CONFIGURED: No active connection for provider ${params.providerId} in ${env}`,
      httpStatus: 400,
      retryable: false
    });
  }
}
