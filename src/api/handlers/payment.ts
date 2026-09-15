import { AppError } from '../../lib/errors/model';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { PaymentHubService } from '../../services/payment_hub/service';
import type { AuthContext } from '../../lib/auth/context';
import type { TenantContext } from '../../lib/context/tenant';
import { requireAuthenticated } from '../../lib/authorization/boundary';
import type { AppContext } from '../middleware';

function isPaymentError(e: unknown): e is AppError {
  return e instanceof AppError;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function jsonError(
  error: { code: string; publicMessage: string },
  status: number,
  requestId: string,
): Response {
  return new Response(
    JSON.stringify({
      error: { code: error.code, message: error.publicMessage, requestId },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

export async function handlePaymentRequest(
  req: Request,
  ctx: AppContext,
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // POST /api/payment/intent
  if (req.method === 'POST' && path === '/api/payment/intent') {
    return handlePaymentIntent(req, ctx);
  }

  // GET /api/payment/:id/status
  if (req.method === 'GET') {
    const statusMatch = path.match(/^\/api\/payment\/([^/]+)\/status$/);
    if (statusMatch) {
      return handlePaymentStatus(statusMatch[1], ctx);
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handlePaymentIntent(
  req: Request,
  ctx: AppContext,
): Promise<Response> {
  try {
    const authCtx = ctx.authCtx;
    let customerId: string | null = null;
    let guestTokenHash: string | undefined;

    if (authCtx.state === 'AUTHENTICATED') {
      requireAuthenticated({ auth: authCtx });
      customerId = authCtx.userId ?? null;
    } else {
      const rawToken = req.headers.get('x-guest-token');
      if (rawToken) {
        const crypto = await import('node:crypto');
        guestTokenHash = crypto
          .createHash('sha256')
          .update(rawToken)
          .digest('hex');
      }
    }

    // Tenant validation
    const tenantCtx = ctx.tenantCtx;
    if (!tenantCtx.isResolved || !tenantCtx.storeId) {
      throw new AppError({
        code: 'TENANT_ACCESS_ERROR',
        publicMessage: 'Invalid store context.',
        internalMessage: 'Payment requires a resolved store context.',
        httpStatus: 403,
        retryable: false,
        requestId: ctx.reqCtx.requestId,
      });
    }

    // Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body || !body.order_id || typeof body.order_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid order_id' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const crypto = await import('node:crypto');
    const idempotencyKey = asString(
      body.idempotency_key || crypto.randomUUID(),
    );

    // Fetch order
    const db = ctx.adminDb;
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select(
        'id, order_number, status, total_amount, currency, store_id, organization_id, customer_id',
      )
      .eq('id', body.order_id)
      .single();

    if (orderErr || !order) {
      return jsonError(
        { code: 'VALIDATION_ERROR', publicMessage: 'Order not found.' },
        404,
        ctx.reqCtx.requestId,
      );
    }

    // Ownership / tenant check
    if (order.store_id !== tenantCtx.storeId) {
      return jsonError(
        {
          code: 'TENANT_ACCESS_ERROR',
          publicMessage: 'Order does not belong to this store.',
        },
        403,
        ctx.reqCtx.requestId,
      );
    }

    if (order.customer_id && customerId && order.customer_id !== customerId) {
      return jsonError(
        {
          code: 'AUTHORIZATION_ERROR',
          publicMessage: 'Order does not belong to this customer.',
        },
        403,
        ctx.reqCtx.requestId,
      );
    }

    if (!customerId && !guestTokenHash) {
      return jsonError(
        {
          code: 'AUTHENTICATION_ERROR',
          publicMessage: 'Authentication or guest token required.',
        },
        401,
        ctx.reqCtx.requestId,
      );
    }

    // State validation
    if (order.status === 'PAID') {
      return jsonError(
        { code: 'CONFLICT', publicMessage: 'Order is already paid.' },
        409,
        ctx.reqCtx.requestId,
      );
    }
    if (order.status === 'CANCELLED') {
      return jsonError(
        { code: 'CONFLICT', publicMessage: 'Order is cancelled.' },
        409,
        ctx.reqCtx.requestId,
      );
    }

    // Create payment intent using PaymentHubService (providerId = "asaas")
    const paymentHub = new PaymentHubService(db);
    const result = await paymentHub.createPaymentIntent({
      orderId: order.id,
      method: 'PIX',
      idempotencyKey,
      providerId: 'asaas',
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (error: any) {
    const status = isPaymentError(error) ? error.httpStatus : 500;
    return jsonError(
      {
        code: error.code || 'INTERNAL_ERROR',
        publicMessage: error.publicMessage || 'Payment failed.',
      },
      status,
      ctx.reqCtx.requestId,
    );
  }
}

async function handlePaymentStatus(
  paymentId: string,
  ctx: AppContext,
): Promise<Response> {
  try {
    const db = ctx.adminDb;
    const { data: payment, error: payErr } = await db
      .from('payments')
      .select('id, status, payment_method, gross_amount, currency, payment_method_details, settled_transaction_id')
      .eq('id', paymentId)
      .maybeSingle();

    if (payErr || !payment) {
      return jsonError(
        { code: 'VALIDATION_ERROR', publicMessage: 'Payment not found.' },
        404,
        ctx.reqCtx.requestId,
      );
    }

    // Fetch latest transaction for this payment (most recent)
    const { data: tx } = await db
      .from('payment_transactions')
      .select('id, status, transaction_id_external, type')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return Response.json({
      data: {
        paymentId: payment.id,
        status: payment.status,
        paymentMethod: payment.payment_method,
        amount: payment.gross_amount,
        currency: payment.currency,
        transactionId: tx?.id ?? null,
        transactionStatus: tx?.status ?? null,
        providerPaymentId: tx?.transaction_id_external ?? null,
        pixDetails: payment.payment_method_details ?? null,
      },
    }, { status: 200 });
  } catch (error: any) {
    return jsonError(
      { code: error.code || 'INTERNAL_ERROR', publicMessage: error.publicMessage || 'Failed to fetch payment status.' },
      500,
      ctx.reqCtx.requestId,
    );
  }
}