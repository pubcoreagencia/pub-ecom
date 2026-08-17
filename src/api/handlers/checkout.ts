import { CheckoutService } from '../../services/checkout';
import { createAdminClient } from '../../lib/supabase/admin';
import crypto from 'crypto';

import type { AppContext } from '../middleware';

export async function handleCheckoutRequest(req: Request, ctx: AppContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const { reqCtx, authCtx, tenantCtx, db } = ctx;

  const checkoutService = new CheckoutService(db, reqCtx, authCtx, tenantCtx);

  try {
    if (req.method === 'POST' && path === '/api/checkout') {
      let body: any;
      try {
        body = await req.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Malformed JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!body || !body.cart_id || typeof body.cart_id !== 'string') {
        return new Response(JSON.stringify({ error: 'Missing or invalid cart_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let guestTokenHash: string | undefined = undefined;
      if (authCtx.state !== 'AUTHENTICATED') {
        const rawToken = req.headers.get('x-guest-token');
        if (rawToken) {
          guestTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        }
      }

      const data = await checkoutService.createCheckout(body.cart_id, guestTokenHash);

      return new Response(JSON.stringify({ data }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    const status = error.httpStatus || 500;
    const errorResponse = {
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.publicMessage || 'An unexpected error occurred.'
      }
    };
    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
