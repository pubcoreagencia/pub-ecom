import { Router, Request, Response } from 'express';
import { CatalogStoreRepository } from '../repositories/catalogStoreRepository';
import { MasterProductRepository } from '../repositories/masterProductRepository';
import { logger } from '../utils/logger';
import { validateCartPayload } from '../validators/cartValidator';
import { EligibilityEngine } from '../services/eligibilityEngine';
import { StoreCoordinationService } from '../services/storeCoordinationService';

export interface CartItemPayload {
  masterProductId: string;
  quantity: number;
  variantId?: string;
}

export interface CartEligibilityRequest {
  storeIds: string[];
  items: CartItemPayload[];
  customerId?: string;
  shippingZip?: string;
  fulfillmentMode?: 'pickup' | 'delivery' | 'in_store';
}

export interface CartEligibilityItem {
  masterProductId: string;
  variantId?: string;
  requestedQuantity: number;
  availableQuantity: number;
  unitPriceCents: number;
  storeId: string;
  storeName: string;
  channel: string;
  status: 'available' | 'partial' | 'unavailable';
  reservationTtlSeconds?: number;
}

export interface CartEligibilityResponse {
  requestId: string;
  totalEligibleStores: number;
  items: CartEligibilityItem[];
  hasMixedCart: boolean;
  requiresOrderSplit: boolean;
  estimatedSubtotalCents: number;
  eligibleAt: string;
  expiresAt: string;
}

export function buildCartEligibilityRouter(
  storeRepo: CatalogStoreRepository,
  productRepo: MasterProductRepository,
  coordinationService: StoreCoordinationService,
  eligibilityEngine: EligibilityEngine,
): Router {
  const router = Router();

  router.post('/v1/cart/eligibility', async (req: Request, res: Response) => {
    const requestId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    try {
      const payload = req.body as CartEligibilityRequest;
      const validation = validateCartPayload(payload);
      if (!validation.ok) {
        return res.status(400).json({
          requestId,
          error: 'INVALID_PAYLOAD',
          details: validation.errors,
        });
      }

      const fulfillmentMode = payload.fulfillmentMode || 'pickup';
      const stores = await storeRepo.findActiveByIds(payload.storeIds);

      if (stores.length === 0) {
        return res.status(404).json({
          requestId,
          error: 'NO_ACTIVE_STORES',
          message: 'Nenhuma loja ativa foi encontrada para os IDs informados.',
        });
      }

      const productIds = Array.from(new Set(payload.items.map((i) => i.masterProductId)));
      const products = await productRepo.findByIds(productIds);
      const productMap = new Map(products.map((p) => [p.id, p]));

      const resolvedItems: CartEligibilityItem[] = [];

      for (const item of payload.items) {
        const product = productMap.get(item.masterProductId);
        if (!product) {
          resolvedItems.push({
            masterProductId: item.masterProductId,
            variantId: item.variantId,
            requestedQuantity: item.quantity,
            availableQuantity: 0,
            unitPriceCents: 0,
            storeId: '',
            storeName: '',
            channel: 'unknown',
            status: 'unavailable',
          });
          continue;
        }

        const bestMatch = await eligibilityEngine.findBestMatch({
          product,
          variantId: item.variantId,
          quantity: item.quantity,
          candidateStores: stores,
          fulfillmentMode,
          shippingZip: payload.shippingZip,
        });

        if (!bestMatch) {
          resolvedItems.push({
            masterProductId: product.id,
            variantId: item.variantId,
            requestedQuantity: item.quantity,
            availableQuantity: 0,
            unitPriceCents: product.basePriceCents,
            storeId: '',
            storeName: '',
            channel: 'unknown',
            status: 'unavailable',
          });
          continue;
        }

        resolvedItems.push({
          masterProductId: product.id,
          variantId: bestMatch.variantId,
          requestedQuantity: item.quantity,
          availableQuantity: bestMatch.availableQuantity,
          unitPriceCents: bestMatch.unitPriceCents,
          storeId: bestMatch.storeId,
          storeName: bestMatch.storeName,
          channel: bestMatch.channel,
          status: bestMatch.availableQuantity >= item.quantity ? 'available' : 'partial',
          reservationTtlSeconds: 180,
        });
      }

      const distinctStoreIds = new Set(
        resolvedItems.filter((i) => i.status !== 'unavailable').map((i) => i.storeId),
      );

      const subtotal = resolvedItems.reduce((acc, item) => {
        const fulfilled = Math.min(item.requestedQuantity, item.availableQuantity);
        return acc + fulfilled * item.unitPriceCents;
      }, 0);

      await coordinationService.publishCartSnapshot({
        requestId,
        customerId: payload.customerId,
        items: resolvedItems,
        storeIds: Array.from(distinctStoreIds),
      });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 180_000);

      const response: CartEligibilityResponse = {
        requestId,
        totalEligibleStores: distinctStoreIds.size,
        items: resolvedItems,
        hasMixedCart: distinctStoreIds.size > 1,
        requiresOrderSplit: distinctStoreIds.size > 1,
        estimatedSubtotalCents: subtotal,
        eligibleAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      logger.info('cart_eligibility_resolved', {
        requestId,
        stores: distinctStoreIds.size,
        items: resolvedItems.length,
        subtotalCents: subtotal,
      });

      return res.status(200).json(response);
    } catch (err) {
      logger.error('cart_eligibility_failed', {
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(500).json({
        requestId,
        error: 'INTERNAL_ERROR',
        message: 'Falha ao processar elegibilidade do carrinho.',
      });
    }
  });

  router.get('/v1/cart/eligibility/:requestId/status', async (req: Request, res: Response) => {
    const snapshot = await coordinationService.getCartSnapshot(req.params.requestId);
    if (!snapshot) {
      return res.status(404).json({ error: 'SNAPSHOT_NOT_FOUND' });
    }
    return res.status(200).json(snapshot);
  });

  return router;
}
