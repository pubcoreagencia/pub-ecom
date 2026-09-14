import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../types/supabase';
import { AppError } from '../../lib/errors/model';
import { CredentialCipher } from '../../lib/crypto/credentials';
import { ConnectionResolver } from './resolver';
import { PaymentProvider, NormalizedPaymentInput } from './types';

export const PROVIDER_REGISTRY: Record<string, PaymentProvider> = {};

import { ExternalCustomerResolver } from './external_identity_resolver';

export class PaymentHubService {
  private cipher = new CredentialCipher();
  private resolver: ConnectionResolver;
  private externalResolver: ExternalCustomerResolver;

  constructor(private db: SupabaseClient<Database>) {
    this.resolver = new ConnectionResolver(db);
    this.externalResolver = new ExternalCustomerResolver(db);
  }

  /**
   * Process a payment intent for an order
   */
  public async createPaymentIntent(params: {
    orderId: string;
    method: 'PIX' | 'CREDIT_CARD';
    idempotencyKey: string;
    cardToken?: string;
    installments?: number;
    providerId?: string;
    environment?: 'SANDBOX' | 'PRODUCTION';
  }) {
    // 1. Fetch order
    const { data: order, error: orderErr } = await this.db
      .from('orders')
      .select('id, order_number, status, total_amount, currency, store_id, organization_id, customer_id')
      .eq('id', params.orderId)
      .single();

    if (orderErr || !order) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Order not found.',
        internalMessage: `ORDER_NOT_FOUND: Order ${params.orderId} not found`,
        httpStatus: 404,
        retryable: false
      });
    }

    if (order.status === 'PAID') {
      throw new AppError({
        code: 'CONFLICT',
        publicMessage: 'This order is already paid.',
        internalMessage: `ORDER_ALREADY_PAID: Order ${order.id} is already in PAID status`,
        httpStatus: 409,
        retryable: false
      });
    }

    // 2. Resolve gateway connection
    const providerId = params.providerId;
    if (!providerId) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Payment provider must be specified.',
        internalMessage: 'MISSING_PROVIDER_ID: providerId is required',
        httpStatus: 400,
        retryable: false
      });
    }

    const connection = await this.resolver.resolve({
      storeId: order.store_id,
      organizationId: order.organization_id,
      providerId,
      environment: params.environment
    });

    const adapter = PROVIDER_REGISTRY[providerId];
    if (!adapter) {
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Selected provider has no active adapter.',
        internalMessage: `PAYMENT_PROVIDER_NOT_IMPLEMENTED: Provider adapter ${providerId} not found in registry`,
        httpStatus: 500,
        retryable: false
      });
    }

    // 3. Upsert / Fetch payment aggregate (concurrency-safe acquisition)
    let { data: payment } = await this.db
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle();

    if (!payment) {
      const { data: newPayment, error: payErr } = await this.db
        .from('payments')
        .insert({
          order_id: order.id,
          provider: providerId,
          gross_amount: order.total_amount,
          currency: order.currency,
          status: 'PENDING',
          payment_method: params.method
        })
        .select()
        .single();

      if (payErr || !newPayment) {
        // Concurrency check: If another concurrent request inserted the payment aggregate first (code 23505 / uq_payments_order_id)
        if (payErr?.code === '23505' || payErr?.message?.includes('uq_payments_order_id')) {
          const { data: existingPayment, error: refetchErr } = await this.db
            .from('payments')
            .select('*')
            .eq('order_id', order.id)
            .single();

          if (refetchErr || !existingPayment) {
            throw new AppError({
              code: 'PAYMENT_ERROR',
              publicMessage: 'Failed to acquire payment aggregate.',
              internalMessage: `PAYMENT_AGGREGATE_CONCURRENT_REFETCH_FAILED: ${refetchErr?.message}`,
              httpStatus: 500,
              retryable: true
            });
          }
          payment = existingPayment;
        } else {
          throw new AppError({
            code: 'PAYMENT_ERROR',
            publicMessage: 'Failed to initialize payment aggregate.',
            internalMessage: `PAYMENT_AGGREGATE_ERROR: ${payErr?.message}`,
            httpStatus: 500,
            retryable: true
          });
        }
      } else {
        payment = newPayment;
      }
    }

    // Now validate existing / acquired payment aggregate state
    if (payment.status === 'PAID' || payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'CHARGEBACK') {
      throw new AppError({
        code: 'CONFLICT',
        publicMessage: 'This order is already settled.',
        internalMessage: `PAYMENT_ALREADY_SETTLED: Payment ${payment.id} is already in settled status ${payment.status}`,
        httpStatus: 409,
        retryable: false
      });
    }

    // Check concurrency: no transaction in PROCESSING
    const { data: activeTx } = await this.db
      .from('payment_transactions')
      .select('id, status')
      .eq('payment_id', payment.id)
      .eq('status', 'PROCESSING')
      .maybeSingle();

    if (activeTx) {
      throw new AppError({
        code: 'CONFLICT',
        publicMessage: 'A payment attempt is currently being processed. Please wait.',
        internalMessage: `CONCURRENT_TRANSACTION_IN_PROCESSING: Transaction ${activeTx.id} is currently PROCESSING`,
        httpStatus: 409,
        retryable: true
      });
    }

    // If aggregate was FAILED, reset to PENDING for new attempt
    if (payment.status === 'FAILED') {
      await this.db
        .from('payments')
        .update({ status: 'PENDING', payment_method: params.method, updated_at: new Date().toISOString() })
        .eq('id', payment.id);
    }

    // 4. Check idempotency for this connection
    const { data: existingTx } = await this.db
      .from('payment_transactions')
      .select('*')
      .eq('gateway_connection_id', connection.id)
      .eq('idempotency_key', params.idempotencyKey)
      .maybeSingle();

    if (existingTx) {
      if (existingTx.status === 'PROCESSING') {
        throw new AppError({
          code: 'IDEMPOTENCY_CONFLICT',
          publicMessage: 'Transaction is processing.',
          internalMessage: 'CONCURRENT_REQUEST: Idempotent replay while still processing',
          httpStatus: 409,
          retryable: true
        });
      }
      // Replay existing outcome
      return {
        paymentId: payment.id,
        transactionId: existingTx.id,
        status: existingTx.status,
        replayed: true,
        rawResponse: existingTx.raw_response
      };
    }

    // 5. Create new payment_transaction in PROCESSING (Protected by unique partial index uq_payment_tx_single_processing)
    const { data: newTx, error: txErr } = await this.db
      .from('payment_transactions')
      .insert({
        payment_id: payment.id,
        gateway_connection_id: connection.id,
        provider: providerId,
        idempotency_key: params.idempotencyKey,
        type: 'PAY',
        amount: order.total_amount,
        status: 'PROCESSING'
      })
      .select()
      .single();

    if (txErr || !newTx) {
      if (txErr?.message?.includes('uq_payment_tx_single_processing')) {
        throw new AppError({
          code: 'CONFLICT',
          publicMessage: 'A payment attempt is currently being processed. Please wait.',
          internalMessage: 'CONCURRENT_PAYMENT_ATTEMPT: Another transaction entered PROCESSING concurrently',
          httpStatus: 409,
          retryable: true
        });
      }
      throw new AppError({
        code: 'PAYMENT_ERROR',
        publicMessage: 'Failed to record payment attempt.',
        internalMessage: `TRANSACTION_CREATION_FAILED: ${txErr?.message}`,
        httpStatus: 500,
        retryable: true
      });
    }

    // 6. Fetch real customer if available
    let customerName = 'Guest Customer';
    let customerEmail = 'guest@checkout.local';
    let customerDocument: string | undefined = undefined;
    if (order.customer_id) {
      const { data: cust } = await this.db
        .from('customers')
        .select('full_name, email, document')
        .eq('id', order.customer_id)
        .maybeSingle();
      if (cust) {
        customerName = cust.full_name || customerName;
        customerEmail = cust.email || customerEmail;
        customerDocument = (cust as any).document;
      }
    }

    // 7. Resolve external customer identity if provider supports it
let externalCustomerId: string | undefined;
if (adapter.capabilities?.createExternalCustomer) {
  const { externalCustomerId: ecId } = await this.externalResolver.getOrCreateExternalCustomer({
    customerId: order.customer_id,
    connection,
    provider: adapter,
    normalizedCustomer: {
      name: customerName,
      email: customerEmail,
      document: customerDocument,
    },
  });
  externalCustomerId = ecId;
}

// 8. Decrypt credentials and call adapter
const decryptedCreds = this.cipher.decrypt(connection.encrypted_credentials);
const input: NormalizedPaymentInput = {
  orderId: order.id,
  orderNumber: order.order_number,
  amount: Number(order.total_amount),
  currency: 'BRL',
  customer: {
    name: customerName,
    email: customerEmail,
  },
  method: params.method,
  cardToken: params.cardToken,
  installments: params.installments,
  idempotencyKey: params.idempotencyKey,
  ...(externalCustomerId ? { externalCustomerId } : {}),
};

    const result = await adapter.createPayment(input, decryptedCreds);

    // 7. If instant success (e.g. approved credit card), settle immediately via RPC
    if (result.status === 'PAID') {
      const { error: settleErr } = await this.db.rpc('settle_payment_transaction', {
        p_payment_id: payment.id,
        p_transaction_id: newTx.id,
        p_connection_id: connection.id,
        p_transaction_id_external: result.providerPaymentId,
        p_verified_amount: Number(order.total_amount),
        p_verified_currency: 'BRL',
        p_gateway_fee: result.fee || 0,
        p_net_amount: result.netAmount || Number(order.total_amount),
        p_verified_outcome: 'SUCCESS'
      });

      if (settleErr) {
        throw new AppError({
          code: 'PAYMENT_ERROR',
          publicMessage: 'Failed to finalize payment.',
          internalMessage: `SETTLEMENT_ERROR: ${settleErr.message}`,
          httpStatus: 500,
          retryable: false
        });
      }
    } else if (result.status === 'FAILED') {
      await this.db.rpc('settle_payment_transaction', {
        p_payment_id: payment.id,
        p_transaction_id: newTx.id,
        p_connection_id: connection.id,
        p_transaction_id_external: result.providerPaymentId,
        p_verified_amount: Number(order.total_amount),
        p_verified_currency: 'BRL',
        p_gateway_fee: 0,
        p_net_amount: 0,
        p_verified_outcome: 'REJECTED'
      });
    } else {
      // e.g. PIX PENDING
      await this.db
        .from('payment_transactions')
        .update({
          transaction_id_external: result.providerPaymentId,
          raw_response: result as any
        })
        .eq('id', newTx.id);

      await this.db
        .from('payments')
        .update({
          payment_method_details: (result.pixDetails || result.cardDetails || {}) as any
        })
        .eq('id', payment.id);
    }

    return {
      paymentId: payment.id,
      transactionId: newTx.id,
      status: result.status,
      pixDetails: result.pixDetails,
      cardDetails: result.cardDetails
    };
  }

  /**
   * Handle incoming webhook
   */
  public async handleWebhook(params: {
    providerId: string;
    connectionId: string;
    headers: Record<string, string>;
    rawBody: string;
  }) {
    // 1. Fetch connection
    const { data: connection, error: connErr } = await this.db
      .from('gateway_connections')
      .select('*')
      .eq('id', params.connectionId)
      .eq('provider_id', params.providerId)
      .single();

    if (connErr || !connection || connection.status !== 'ACTIVE') {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        publicMessage: 'Invalid gateway connection.',
        internalMessage: 'CONNECTION_NOT_FOUND: Connection not found or inactive',
        httpStatus: 404,
        retryable: false
      });
    }

    const adapter = PROVIDER_REGISTRY[params.providerId];
    if (!adapter) {
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Provider not implemented',
        internalMessage: `PAYMENT_PROVIDER_NOT_IMPLEMENTED: Adapter ${params.providerId} missing`,
        httpStatus: 500,
        retryable: false
      });
    }

    // 2. Decrypt webhook secret and verify signature
    let webhookSecret = '';
    if (connection.webhook_secret_encrypted) {
      webhookSecret = this.cipher.decrypt(connection.webhook_secret_encrypted);
    }

    const verification = await adapter.verifyWebhook(params.headers, params.rawBody, webhookSecret);
    if (!verification.isValid) {
      throw new AppError({
        code: 'AUTHENTICATION_ERROR',
        publicMessage: 'Unauthorized webhook.',
        internalMessage: 'INVALID_WEBHOOK_SIGNATURE: Signature verification failed',
        httpStatus: 401,
        retryable: false
      });
    }

    // 3. Check deduplication
    const { data: existingEvent } = await this.db
      .from('gateway_webhook_events')
      .select('id, processing_status')
      .eq('gateway_connection_id', connection.id)
      .eq('event_dedup_key', verification.eventDedupKey)
      .maybeSingle();

    if (existingEvent) {
      return { status: 'DEDUP_SKIPPED', eventId: existingEvent.id };
    }

    // 4. Persist event
    let rawJson: any = {};
    try { rawJson = JSON.parse(params.rawBody); } catch { rawJson = { raw: params.rawBody }; }

    const { data: newEvent, error: evErr } = await this.db
      .from('gateway_webhook_events')
      .insert({
        gateway_connection_id: connection.id,
        event_dedup_key: verification.eventDedupKey,
        provider_resource_id: verification.resourceId,
        event_type: verification.eventType,
        raw_payload: rawJson,
        processing_status: 'PENDING'
      })
      .select()
      .single();

    if (evErr || !newEvent) {
      throw new AppError({
        code: 'PAYMENT_ERROR',
        publicMessage: 'Failed to record event.',
        internalMessage: `WEBHOOK_PERSIST_ERROR: ${evErr?.message}`,
        httpStatus: 500,
        retryable: true
      });
    }

    // 5. Active Re-Fetch and Settle
    const creds = this.cipher.decrypt(connection.encrypted_credentials);
    const paymentStatus = await adapter.getPayment(verification.resourceId, creds);

    // Locate transaction by external id
    const { data: tx } = await this.db
      .from('payment_transactions')
      .select('id, payment_id, status, amount')
      .eq('gateway_connection_id', connection.id)
      .eq('transaction_id_external', verification.resourceId)
      .maybeSingle();

    if (tx && paymentStatus.status === 'PAID') {
      const outcome = paymentStatus.status === 'PAID' ? 'SUCCESS' : 'REJECTED';
      await this.db.rpc('settle_payment_transaction', {
        p_payment_id: tx.payment_id,
        p_transaction_id: tx.id,
        p_connection_id: connection.id,
        p_transaction_id_external: verification.resourceId,
        p_verified_amount: Number(paymentStatus.amount),
        p_verified_currency: paymentStatus.currency,
        p_gateway_fee: paymentStatus.fee || 0,
        p_net_amount: paymentStatus.netAmount || paymentStatus.amount,
        p_verified_outcome: outcome
      });

      await this.db
        .from('gateway_webhook_events')
        .update({ processing_status: 'PROCESSED', processed_at: new Date().toISOString() })
        .eq('id', newEvent.id);
    }

    return { status: 'PROCESSED', eventId: newEvent.id };
  }
}
