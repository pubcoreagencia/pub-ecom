import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

interface EligibilityRequest {
  cartItems: Array<{
    productId: string;
    storeId: string;
    quantity: number;
    unitPrice: number;
  }>;
  customerId?: string;
  shippingZipCode?: string;
  paymentMethod: 'pix' | 'credit_card' | 'boleto';
}

interface EligibilityItem {
  productId: string;
  storeId: string;
  storeName: string;
  available: boolean;
  stock: number;
  requestedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  shippingSupported: boolean;
  active: boolean;
  rejectionReasons: string[];
}

interface EligibilityResponse {
  eligible: boolean;
  totalItems: number;
  totalAmount: number;
  totalShipping: number;
  grandTotal: number;
  items: EligibilityItem[];
  globalRejections: string[];
  estimatedDeliveryDays: number;
  timestamp: string;
}

interface StoreRules {
  storeId: string;
  storeName: string;
  minOrderAmount: number;
  shippingBaseCost: number;
  shippingFreeThreshold: number;
  activeRegions: string[];
  acceptsPix: boolean;
  acceptsCreditCard: boolean;
  acceptsBoleto: boolean;
  syncStatus: 'synced' | 'syncing' | 'error' | 'disabled';
}

export class CheckoutEligibilityService {
  constructor(private db: Pool) {}

  async checkEligibility(req: EligibilityRequest): Promise<EligibilityResponse> {
    const globalRejections: string[] = [];

    if (!req.cartItems || req.cartItems.length === 0) {
      globalRejections.push('EMPTY_CART');
      return this.buildEmptyResponse(globalRejections);
    }

    const productIds = req.cartItems.map((i) => i.productId);
    const storeIds = Array.from(new Set(req.cartItems.map((i) => i.storeId)));

    const productsResult = await this.db.query(
      `SELECT p.id AS product_id, p.store_id, p.title, p.price, p.active,
              s.name AS store_name, s.active AS store_active, s.sync_status,
              i.quantity AS stock
       FROM master_products p
       INNER JOIN catalog_stores s ON s.id = p.store_id
       LEFT JOIN catalog_inventory i ON i.product_id = p.id AND i.store_id = p.store_id
       WHERE p.id = ANY($1::uuid[])`,
      [productIds]
    );

    const storeRulesResult = await this.db.query(
      `SELECT id AS store_id, name AS store_name, min_order_amount,
              shipping_base_cost, shipping_free_threshold, active_regions,
              accepts_pix, accepts_credit_card, accepts_boleto, sync_status
       FROM catalog_stores WHERE id = ANY($1::uuid[])`,
      [storeIds]
    );

    const storeRulesMap = new Map<string, StoreRules>();
    for (const row of storeRulesResult.rows) {
      storeRulesMap.set(row.store_id, {
        storeId: row.store_id,
        storeName: row.store_name,
        minOrderAmount: parseFloat(row.min_order_amount ?? '0'),
        shippingBaseCost: parseFloat(row.shipping_base_cost ?? '0'),
        shippingFreeThreshold: parseFloat(row.shipping_free_threshold ?? '0'),
        activeRegions: row.active_regions ?? [],
        acceptsPix: row.accepts_pix,
        acceptsCreditCard: row.accepts_credit_card,
        acceptsBoleto: row.accepts_boleto,
        syncStatus: row.sync_status,
      });
    }

    const productsMap = new Map<string, any>();
    for (const row of productsResult.rows) {
      productsMap.set(row.product_id, row);
    }

    const storeTotals = new Map<string, number>();
    const eligibilityItems: EligibilityItem[] = [];

    for (const cartItem of req.cartItems) {
      const product = productsMap.get(cartItem.productId);
      const storeRule = storeRulesMap.get(cartItem.storeId);
      const rejectionReasons: string[] = [];

      if (!product) {
        rejectionReasons.push('PRODUCT_NOT_FOUND');
      } else {
        if (!product.active) rejectionReasons.push('PRODUCT_INACTIVE');
        if (!product.store_active) rejectionReasons.push('STORE_INACTIVE');
        if (product.sync_status === 'disabled') rejectionReasons.push('STORE_SYNC_DISABLED');

        const stock = parseInt(product.stock ?? '0', 10);
        if (stock < cartItem.quantity) {
          rejectionReasons.push(`INSUFFICIENT_STOCK:${stock}:${cartItem.quantity}`);
        }

        const dbPrice = parseFloat(product.price);
        if (Math.abs(dbPrice - cartItem.unitPrice) > 0.01) {
          rejectionReasons.push('PRICE_MISMATCH');
        }
      }

      if (!storeRule) {
        rejectionReasons.push('STORE_NOT_FOUND');
      } else {
        if (req.paymentMethod === 'pix' && !storeRule.acceptsPix) {
          rejectionReasons.push('PAYMENT_PIXX_NOT_SUPPORTED');
        }
        if (req.paymentMethod === 'credit_card' && !storeRule.acceptsCreditCard) {
          rejectionReasons.push('PAYMENT_CARD_NOT_SUPPORTED');
        }
        if (req.paymentMethod === 'boleto' && !storeRule.acceptsBoleto) {
          rejectionReasons.push('PAYMENT_BOLETO_NOT_SUPPORTED');
        }
      }

      const available = rejectionReasons.length === 0;
      const totalPrice = cartItem.unitPrice * cartItem.quantity;

      eligibilityItems.push({
        productId: cartItem.productId,
        storeId: cartItem.storeId,
        storeName: storeRule?.storeName ?? 'UNKNOWN',
        available,
        stock: parseInt(product?.stock ?? '0', 10),
        requestedQuantity: cartItem.quantity,
        unitPrice: cartItem.unitPrice,
        totalPrice,
        shippingSupported: !!storeRule,
        active: product?.active ?? false,
        rejectionReasons,
      });

      if (available) {
        const currentTotal = storeTotals.get(cartItem.storeId) ?? 0;
        storeTotals.set(cartItem.storeId, currentTotal + totalPrice);
      }
    }

    let totalShipping = 0;
    let maxDeliveryDays = 0;

    for (const [storeId, subtotal] of storeTotals.entries()) {
      const rule = storeRulesMap.get(storeId);
      if (!rule) continue;

      if (subtotal < rule.minOrderAmount) {
        globalRejections.push(`STORE_MISMATCH_MIN_ORDER:${rule.storeName}:${rule.minOrderAmount}`);
      }

      if (subtotal >= rule.shippingFreeThreshold) {
        // free
      } else {
        totalShipping += rule.shippingBaseCost;
      }

      maxDeliveryDays += 3;
    }

    if (storeIds.length > 3) {
      globalRejections.push('TOO_MANY_STORES_IN_CART');
    }

    const totalAmount = eligibilityItems
      .filter((i) => i.available)
      .reduce((sum, i) => sum + i.totalPrice, 0);

    const eligible =
      globalRejections.length === 0 && eligibilityItems.some((i) => i.available);

    return {
      eligible,
      totalItems: req.cartItems.length,
      totalAmount,
      totalShipping,
      grandTotal: totalAmount + totalShipping,
      items: eligibilityItems,
      globalRejections,
      estimatedDeliveryDays: maxDeliveryDays,
      timestamp: new Date().toISOString(),
    };
  }

  private buildEmptyResponse(rejections: string[]): EligibilityResponse {
    return {
      eligible: false,
      totalItems: 0,
      totalAmount: 0,
      totalShipping: 0,
      grandTotal: 0,
      items: [],
      globalRejections: rejections,
      estimatedDeliveryDays: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

export function createCheckoutEligibilityRouter(db: Pool): Router {
  const router = Router();
  const service = new CheckoutEligibilityService(db);

  router.post('/checkout/eligibility', async (req: Request, res: Response) => {
    try {
      const body = req.body as EligibilityRequest;
      const result = await service.checkEligibility(body);
      res.status(result.eligible ? 200 : 409).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      res.status(500).json({ eligible: false, error: message });
    }
  });

  router.get('/checkout/eligibility/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'checkout-eligibility', version: '1.0.0' });
  });

  return router;
}
