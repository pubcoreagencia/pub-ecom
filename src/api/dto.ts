import type { Database } from '../../types/supabase';
import type { CatalogRepository } from '../repositories/catalog';

type CartRow = Database['public']['Tables']['carts']['Row'];
type CartItemRow = Database['public']['Tables']['cart_items']['Row'];

export interface CartItemDTO {
  id: string;
  variantId: string;
  quantity: number;
  salePrice: number;
  lineTotal: number;
}

export interface CartDTO {
  id: string;
  status: string;
  items: CartItemDTO[];
  subtotal: number;
  total: number;
}

export async function mapCartToResponse(
  cart: CartRow,
  items: CartItemRow[],
  catalogRepo: CatalogRepository
): Promise<CartDTO> {
  let subtotal = 0;
  const itemDTOs: CartItemDTO[] = [];

  for (const item of items) {
    // Authoritative pricing boundary: Fetch the true price from the DB
    const detail = await catalogRepo.getStoreVariantDetail(item.store_product_variant_id);
    
    // In case a variant was deleted or made inactive between cart resolution and now,
    // we can either drop it from the response or price it at 0.
    // Standard practice is to ignore it or drop it, but we'll include it at 0 if missing.
    // However, our addCartItem prevents inactive variants.
    const salePrice = detail?.variant.sale_price || 0;
    
    // Integer arithmetic (assuming sale_price is an integer representation of currency, e.g. cents)
    const lineTotal = Math.round(salePrice * item.quantity);
    subtotal += lineTotal;

    itemDTOs.push({
      id: item.id,
      variantId: item.store_product_variant_id,
      quantity: item.quantity,
      salePrice: salePrice,
      lineTotal: lineTotal
    });
  }

  return {
    id: cart.id,
    status: cart.status as string,
    items: itemDTOs,
    subtotal: subtotal,
    total: subtotal // Extensions like shipping/taxes would apply here in future phases
  };
}
