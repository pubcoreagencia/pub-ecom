import { withStoreContext } from './middleware';
import { withCors } from './cors';
import { handleCustomerRequest } from './handlers/customer';
import { handleGuestCartRequest, handleAuthCartRequest } from './handlers/cart';
import { handleCatalogRequest } from './handlers/catalog';
import { handleCheckoutRequest } from './handlers/checkout';

async function dispatch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.startsWith('/api/customer')) {
    if (['GET', 'POST', 'PATCH'].includes(req.method)) {
      return await withStoreContext(handleCustomerRequest)(req);
    }
    return new Response(null, { status: 405 });
  }

  if (path.startsWith('/api/guest-cart')) {
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      return await withStoreContext(handleGuestCartRequest)(req);
    }
    return new Response(null, { status: 405 });
  }

  if (path.startsWith('/api/cart')) {
    if (['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
      return await withStoreContext(handleAuthCartRequest)(req);
    }
    return new Response(null, { status: 405 });
  }

  if (path.startsWith('/api/catalog')) {
    if (['GET'].includes(req.method)) {
      return await withStoreContext(handleCatalogRequest)(req);
    }
    return new Response(null, { status: 405 });
  }

  if (path.startsWith('/api/checkout')) {
    if (['POST'].includes(req.method)) {
      return await withStoreContext(handleCheckoutRequest)(req);
    }
    return new Response(null, { status: 405 });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Wrap dispatcher with CORS
export const router = withCors(dispatch);
