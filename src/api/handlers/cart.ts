import { CartService } from '../../services/cart';
import { AppError } from '../../lib/errors/model';
import { mapCartToResponse } from '../dto';
import { CatalogRepository } from '../../repositories/catalog';
import { CartRepository } from '../../repositories/cart';
import type { AppContext } from '../middleware';

function getGuestToken(req: Request): string {
  const token = req.headers.get('x-guest-token');
  if (!token) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      publicMessage: 'Missing guest token.',
      internalMessage: 'x-guest-token header is required for guest cart operations.',
      httpStatus: 401,
      retryable: false
    });
  }
  return token;
}

export async function handleGuestCartRequest(req: Request, ctx: AppContext): Promise<Response> {
  const cartService = new CartService(ctx.db, ctx.reqCtx, ctx.authCtx, ctx.tenantCtx, ctx.adminDb);
  const cartRepo = new CartRepository(ctx.db, ctx.reqCtx, ctx.adminDb);
  const catalogRepo = new CatalogRepository(ctx.adminDb, ctx.reqCtx);

  const url = new URL(req.url);
  const path = url.pathname;

  switch (req.method) {
    case 'POST': {
      if (path.endsWith('/guest-cart')) {
        // Create new guest cart
        const result = await cartService.createGuestCart();
        return new Response(JSON.stringify({ data: { cart_id: result.cartId, guest_token: result.rawToken } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path.endsWith('/guest-cart/items')) {
        // Add item
        const token = getGuestToken(req);
        const body = await req.json().catch(() => ({}));
        await cartService.addGuestItem(token, { variantId: body.variant_id, quantity: body.quantity });
        
        // Return full cart state
        const cart = await cartService.resolveGuestCart(token);
        const items = await cartRepo.getCartItems(cart!.id);
        const dto = await mapCartToResponse(cart!, items, catalogRepo);
        
        return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      break;
    }

    case 'GET': {
      const token = getGuestToken(req);
      const cart = await cartService.resolveGuestCart(token);
      if (!cart) {
        throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Cart not found.', internalMessage: 'Invalid guest token.', httpStatus: 404, retryable: false });
      }
      
      const items = await cartRepo.getCartItems(cart.id);
      const dto = await mapCartToResponse(cart, items, catalogRepo);
      return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    case 'PATCH': {
      // Update item
      const token = getGuestToken(req);
      const body = await req.json().catch(() => ({}));
      await cartService.updateGuestItem(token, { variantId: body.variant_id, quantity: body.quantity });
      
      const cart = await cartService.resolveGuestCart(token);
      const items = await cartRepo.getCartItems(cart!.id);
      const dto = await mapCartToResponse(cart!, items, catalogRepo);
      
      return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    case 'DELETE': {
      // Remove item
      const token = getGuestToken(req);
      const variantId = url.searchParams.get('variant_id');
      if (!variantId) throw new Error('variant_id required');
      
      await cartService.removeGuestItem(token, variantId);
      
      const cart = await cartService.resolveGuestCart(token);
      const items = await cartRepo.getCartItems(cart!.id);
      const dto = await mapCartToResponse(cart!, items, catalogRepo);
      
      return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
}


export async function handleAuthCartRequest(req: Request, ctx: AppContext): Promise<Response> {
  const cartService = new CartService(ctx.db, ctx.reqCtx, ctx.authCtx, ctx.tenantCtx, ctx.adminDb);
  const cartRepo = new CartRepository(ctx.db, ctx.reqCtx, ctx.adminDb);
  const catalogRepo = new CatalogRepository(ctx.adminDb, ctx.reqCtx);
  
  const url = new URL(req.url);
  const path = url.pathname;

  switch (req.method) {
    case 'GET': {
      const cart = await cartService.getAuthCart();
      if (!cart) {
        return new Response(JSON.stringify({ data: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      const items = await cartRepo.getCartItems(cart.id);
      const dto = await mapCartToResponse(cart, items, catalogRepo);
      return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    case 'POST': {
      if (path.endsWith('/cart/merge')) {
        const body = await req.json().catch(() => ({}));
        if (!body.guest_cart_id || !body.guest_token) throw new AppError({ code: 'VALIDATION_ERROR', publicMessage: 'Missing merge inputs', internalMessage: 'Missing guest token or id', httpStatus: 400, retryable: false });
        
        await cartService.mergeGuestCart(body.guest_cart_id, body.guest_token);
        
        const cart = await cartService.getAuthCart();
        const items = await cartRepo.getCartItems(cart!.id);
        const dto = await mapCartToResponse(cart!, items, catalogRepo);
        
        return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } else if (path.endsWith('/cart/items')) {
        const body = await req.json().catch(() => ({}));
        await cartService.addAuthItem({ variantId: body.variant_id, quantity: body.quantity });
        
        const cart = await cartService.getAuthCart();
        const items = await cartRepo.getCartItems(cart!.id);
        const dto = await mapCartToResponse(cart!, items, catalogRepo);
        
        return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      break;
    }

    case 'PATCH': {
      const body = await req.json().catch(() => ({}));
      await cartService.updateAuthItem({ variantId: body.variant_id, quantity: body.quantity });
      
      const cart = await cartService.getAuthCart();
      const items = await cartRepo.getCartItems(cart!.id);
      const dto = await mapCartToResponse(cart!, items, catalogRepo);
      
      return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    case 'DELETE': {
      const variantId = url.searchParams.get('variant_id');
      if (!variantId) throw new Error('variant_id required');
      
      await cartService.removeAuthItem(variantId);
      
      const cart = await cartService.getAuthCart();
      const items = await cartRepo.getCartItems(cart!.id);
      const dto = await mapCartToResponse(cart!, items, catalogRepo);
      
      return new Response(JSON.stringify({ data: dto }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
}
