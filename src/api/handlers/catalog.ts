import { CatalogService } from '../../services/catalog';
import { createAdminClient } from '../../lib/supabase/admin';

import type { AppContext } from '../middleware';

export async function handleCatalogRequest(req: Request, ctx: AppContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const { reqCtx, authCtx, tenantCtx, db } = ctx;

  const catalogService = new CatalogService(db, reqCtx, authCtx, tenantCtx);

  try {
    if (req.method === 'GET' && path === '/api/catalog/products') {
      const data = await catalogService.resolveStoreCatalog();
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET' && path.startsWith('/api/catalog/products/')) {
      const productId = path.split('/').pop();
      if (!productId) {
        return new Response(JSON.stringify({ error: 'Missing product ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const data = await catalogService.resolveStoreProduct(productId);
      return new Response(JSON.stringify({ data }), {
        status: 200,
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
