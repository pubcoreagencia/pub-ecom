// src/services/payment_hub/external_identity_resolver.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../types/supabase';
import { AppError } from '../../lib/errors/model';
import { PaymentProvider, ExternalCustomerCapability, GatewayCredentials } from './types';
import { logger } from '../../lib/logging/logger';

/**
 * Resolver that ensures a single external customer identity per (customer, connection).
 * Uses reservation rows in `customer_gateway_identities` to coordinate concurrent requests.
 */
export class ExternalCustomerResolver {
  private dbAny: any;

  constructor(private db: SupabaseClient<Database>) {
    this.dbAny = db as any; // simplify typing for RPC calls
  }

  /**
   * Main entry point. Returns the external customer ID and optional metadata.
   * The caller must provide decrypted credentials via the credentials param.
   */
  async getOrCreateExternalCustomer(params: {
    customerId: string;
    connection: any; // raw connection row from resolver
    provider: PaymentProvider & { capabilities?: ExternalCustomerCapability };
    normalizedCustomer: { name: string; email: string; document?: string };
    credentials?: GatewayCredentials;
  }): Promise<{ externalCustomerId: string; metadata?: Record<string, unknown> }> {
    const { customerId, connection, provider, normalizedCustomer, credentials = {} } = params;

    // 1️⃣ Attempt to create a PENDING reservation atomically.
    const { data: reservation, error: insertErr } = await this.dbAny
      .from('customer_gateway_identities')
      .insert({
        customer_id: customerId,
        connection_id: connection.id,
        external_customer_id: null,
        status: 'PENDING',
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    // If we successfully inserted, we are the OWNER.
    const isOwner = !!reservation && !insertErr;

    // Helper to fetch the current identity row.
    const fetchIdentity = async () => {
      const { data, error } = await this.dbAny
        .from('customer_gateway_identities')
        .select('*')
        .eq('customer_id', customerId)
        .eq('connection_id', connection.id)
        .maybeSingle();
      if (error) {
        throw new AppError({
          code: 'INTERNAL_ERROR',
          publicMessage: 'Failed to fetch external identity.',
          internalMessage: `EXTERNAL_IDENTITY_FETCH_ERROR: ${error.message}`,
          httpStatus: 500,
          retryable: true
        });
      }
      return data;
    };

    // 2️⃣ If not owner, load the existing row.
    let identity = isOwner ? reservation : await fetchIdentity();

    // 3️⃣ Handle the different statuses.
    if (identity && identity.status === 'ACTIVE' && identity.external_customer_id) {
      return { externalCustomerId: identity.external_customer_id };
    }

    // Helper to wait for a row to become ACTIVE (or FAILED) with back‑off.
    const waitForResolution = async (maxWaitMs: number = 15000): Promise<any> => {
      const backoffs = [500, 1000, 2000, 4000]; // ms
      let elapsed = 0;
      for (const delay of backoffs) {
        await new Promise(res => setTimeout(res, delay));
        elapsed += delay;
        const current = await fetchIdentity();
        if (current && current.status !== 'PENDING') {
          return current;
        }
        if (elapsed >= maxWaitMs) break;
      }
      // final check after timeout
      return await fetchIdentity();
    };

    if (!isOwner && identity && identity.status === 'PENDING') {
      // Follow‑up request – poll until the owner resolves the reservation.
      const finalState = await waitForResolution();
      if (finalState && finalState.status === 'ACTIVE' && finalState.external_customer_id) {
        return { externalCustomerId: finalState.external_customer_id };
      }
      // If we timed out or ended in FAILED, treat as a concurrency error.
      throw new AppError({
        code: 'CONFLICT',
        publicMessage: 'External customer creation is in progress. Please retry later.',
        internalMessage: 'PENDING_RESERVATION_TIMEOUT',
        httpStatus: 409,
        retryable: true
      });
    }

    // FAILED or missing row – we may attempt to become the owner.
    if (!isOwner && identity && identity.status === 'FAILED') {
      // Try to claim the reservation by resetting it to PENDING.
      const { data: claimed, error: claimErr } = await this.dbAny
        .from('customer_gateway_identities')
        .update({
          status: 'PENDING',
          external_customer_id: null,
          metadata: null,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', customerId)
        .eq('connection_id', connection.id)
        .eq('status', 'FAILED')
        .select()
        .maybeSingle();
      if (!claimErr && claimed) {
        // We successfully claimed the reservation.
        identity = claimed;
        // Proceed as owner.
      } else {
        // Someone else claimed it first – fall back to polling.
        const finalState = await waitForResolution();
        if (finalState && finalState.status === 'ACTIVE' && finalState.external_customer_id) {
          return { externalCustomerId: finalState.external_customer_id };
        }
        throw new AppError({
          code: 'CONFLICT',
          publicMessage: 'External customer creation conflict. Please retry.',
          internalMessage: 'FAILED_RESERVATION_CLAIM_RACE',
          httpStatus: 409,
          retryable: true
        });
      }
    }

    // At this point we are the owner (either first insert or claimed FAILED).
    // Optional reconciliation step.
    const reconcile = provider.capabilities?.reconcileExternalCustomer;
    if (reconcile) {
      try {
        const reconciledId = await reconcile({
          customerId,
          connectionId: connection.id,
          normalizedCustomer
        }, credentials);
        if (reconciledId) {
          await this.dbAny
            .from('customer_gateway_identities')
            .update({
              external_customer_id: reconciledId,
              status: 'ACTIVE',
              updated_at: new Date().toISOString()
            })
            .eq('customer_id', customerId)
            .eq('connection_id', connection.id);
          return { externalCustomerId: reconciledId };
        }
      } catch (e) {
        logger.error('Reconciliation failed', undefined, e as any);
        // Continue to creation path.
      }
    }

    // Create the external customer via provider capability.
    const createFn = provider.capabilities?.createExternalCustomer;
    if (!createFn) {
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Provider does not support external customer creation.',
        internalMessage: 'MISSING_CREATE_EXTERNAL_CUSTOMER_CAPABILITY',
        httpStatus: 500,
        retryable: false
      });
    }

    let created;
    try {
      created = await createFn({
        customerId,
        connectionId: connection.id,
        normalizedCustomer,
        idempotencyKey: `${customerId}-${connection.id}`
      }, credentials);
    } catch (e: any) {
      // Mark reservation as FAILED.
      await this.dbAny
        .from('customer_gateway_identities')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('customer_id', customerId)
        .eq('connection_id', connection.id);
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Failed to create external customer.',
        internalMessage: `EXTERNAL_CREATE_ERROR: ${e.message}`,
        httpStatus: 502,
        retryable: true
      });
    }

    // Store the successful result.
    await this.dbAny
      .from('customer_gateway_identities')
      .update({
        external_customer_id: created.externalId,
        status: 'ACTIVE',
        metadata: created.metadata || null,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .eq('connection_id', connection.id);

    return { externalCustomerId: created.externalId, metadata: created.metadata };
  }
}
