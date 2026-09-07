import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

/**
 * API de Promoções e Elegibilidade de Carrinho
 *
 * Endpoints:
 *   POST /cart/eligibility        - valida elegibilidade do carrinho (descontos, frete, cupons)
 *   POST /cart/apply-coupon       - valida e aplica cupom de desconto ao carrinho
 *   POST /cart/promotions/preview - pré-visualiza promoções aplicáveis sem persistir
 *
 * Regras:
 *   - Cupons podem ser PERCENT (%), FIXED (R$) ou BOGO (leve X pague Y)
 *   - Promoções automáticas têm prioridade menor que cupons manuais
 *   - Limite máximo de desconto por cupom: R$ 500,00 (proteção anti-fraude)
 *   - Pedido mínimo configurável por cupom
 */

export type CouponType = 'PERCENT' | 'FIXED' | 'BOGO';

export interface Coupon {
  code: string;
  type: CouponType;
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  expiresAt: Date;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
}

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  category: string;
}

export interface CartPayload {
  storeId: string;
  items: CartItem[];
  couponCode?: string;
  customerId?: string;
}

interface EligibilityResult {
  eligible: boolean;
  subtotal: number;
  discounts: AppliedDiscount[];
  totalDiscount: number;
  shipping: number;
  total: number;
  warnings: string[];
  errors: string[];
}

interface AppliedDiscount {
  source: 'AUTO_PROMO' | 'COUPON';
  code: string;
  description: string;
  amount: number;
  type: CouponType | 'SHIPPING';
}

const MAX_COUPON_DISCOUNT = 500.0;
const FREE_SHIPPING_THRESHOLD = 150.0;
const STANDARD_SHIPPING_FEE = 19.9;

export class CartPromotionsService {
  constructor(private readonly db: Pool) {}

  async getCouponByCode(code: string): Promise<Coupon | null> {
    const normalized = code.trim().toUpperCase();
    const result = await this.db.query<Coupon>(
      `SELECT code,
              type::text AS type,
              value,
              min_subtotal AS "minSubtotal",
              max_discount AS "maxDiscount",
              expires_at AS "expiresAt",
              active,
              usage_limit AS "usageLimit",
              usage_count AS "usageCount"
         FROM coupons
        WHERE UPPER(code) = $1
          AND active = true
          AND expires_at > NOW()
        LIMIT 1`,
      [normalized],
    );
    return result.rows[0] ?? null;
  }

  computeSubtotal(items: CartItem[]): number {
    return items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
  }

  computeCouponDiscount(coupon: Coupon, subtotal: number): number {
    if (subtotal < coupon.minSubtotal) return 0;

    let rawDiscount = 0;
    switch (coupon.type) {
      case 'PERCENT':
        rawDiscount = subtotal * (coupon.value / 100);
        break;
      case 'FIXED':
        rawDiscount = coupon.value;
        break;
      case 'BOGO':
        // BOGO: value representa a fração a pagar (ex: 0.5 = pague metade no segundo item)
        rawDiscount = subtotal * (1 - coupon.value) * 0.5;
        break;
    }

    const capped = coupon.maxDiscount !== null
      ? Math.min(rawDiscount, coupon.maxDiscount)
      : rawDiscount;

    return Math.min(capped, MAX_COUPON_DISCOUNT, subtotal);
  }

  computeShipping(subtotalAfterDiscount: number): number {
    return subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD
      ? 0
      : STANDARD_SHIPPING_FEE;
  }

  async evaluateEligibility(payload: CartPayload): Promise<EligibilityResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!payload.storeId) errors.push('storeId é obrigatório');
    if (!payload.items || payload.items.length === 0) {
      errors.push('Carrinho vazio');
    }
    for (const item of payload.items) {
      if (item.quantity <= 0) {
        errors.push(`Item ${item.sku} possui quantidade inválida`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Item ${item.sku} possui preço negativo`);
      }
    }

    if (errors.length > 0) {
      return {
        eligible: false,
        subtotal: 0,
        discounts: [],
        totalDiscount: 0,
        shipping: 0,
        total: 0,
        warnings,
        errors,
      };
    }

    const subtotal = this.computeSubtotal(payload.items);
    const discounts: AppliedDiscount[] = [];
    let totalDiscount = 0;

    if (payload.couponCode) {
      const coupon = await this.getCouponByCode(payload.couponCode);
      if (!coupon) {
        errors.push(`Cupom ${payload.couponCode} inválido ou expirado`);
      } else if (
        coupon.usageLimit !== null &&
        coupon.usageCount >= coupon.usageLimit
      ) {
        errors.push(`Cupom ${coupon.code} atingiu o limite de uso`);
      } else if (subtotal < coupon.minSubtotal) {
        warnings.push(
          `Cupom ${coupon.code} exige subtotal mínimo de R$ ${coupon.minSubtotal.toFixed(2)}`,
        );
      } else {
        const amount = this.computeCouponDiscount(coupon, subtotal);
        if (amount > 0) {
          discounts.push({
            source: 'COUPON',
            code: coupon.code,
            description: `Cupom ${coupon.code} (${coupon.type})`,
            amount,
            type: coupon.type,
          });
          totalDiscount += amount;
        }
      }
    }

    const subtotalAfterDiscount = Math.max(0, subtotal - totalDiscount);
    const shipping = this.computeShipping(subtotalAfterDiscount);

    if (shipping === 0 && subtotal > 0) {
      discounts.push({
        source: 'AUTO_PROMO',
        code: 'FRETE-GRATIS',
        description: `Frete grátis para compras acima de R$ ${FREE_SHIPPING_THRESHOLD.toFixed(2)}`,
        amount: STANDARD_SHIPPING_FEE,
        type: 'SHIPPING',
      });
      totalDiscount += STANDARD_SHIPPING_FEE;
    }

    return {
      eligible: errors.length === 0,
      subtotal: Number(subtotal.toFixed(2)),
      discounts,
      totalDiscount: Number(totalDiscount.toFixed(2)),
      shipping: Number(shipping.toFixed(2)),
      total: Number(Math.max(0, subtotal - totalDiscount + (shipping === 0 ? 0 : STANDARD_SHIPPING_FEE)).toFixed(2)),
      warnings,
      errors,
    };
  }
}

export function buildCartPromotionsRouter(db: Pool): Router {
  const router = Router();
  const service = new CartPromotionsService(db);

  router.post('/cart/eligibility', async (req: Request, res: Response) => {
    try {
      const payload = req.body as CartPayload;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Payload inválido' });
      }
      const result = await service.evaluateEligibility(payload);
      return res.status(result.eligible ? 200 : 422).json(result);
    } catch (err) {
      return res.status(500).json({
        error: 'Erro interno ao avaliar elegibilidade do carrinho',
        details: (err as Error).message,
      });
    }
  });

  router.post('/cart/apply-coupon', async (req: Request, res: Response) => {
    try {
      const { code, storeId } = req.body as { code: string; storeId: string };
      if (!code || !storeId) {
        return res.status(400).json({ error: 'code e storeId são obrigatórios' });
      }
      const coupon = await service.getCouponByCode(code);
      if (!coupon) {
        return res.status(404).json({ error: 'Cupom não encontrado ou expirado' });
      }
      return res.status(200).json({
        valid: true,
        coupon: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          minSubtotal: coupon.minSubtotal,
          maxDiscount: coupon.maxDiscount,
          expiresAt: coupon.expiresAt,
        },
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Erro ao aplicar cupom',
        details: (err as Error).message,
      });
    }
  });

  router.post('/cart/promotions/preview', async (req: Request, res: Response) => {
    try {
      const payload = req.body as CartPayload;
      const result = await service.evaluateEligibility(payload);
      return res.status(200).json({ preview: true, ...result });
    } catch (err) {
      return res.status(500).json({
        error: 'Erro ao pré-visualizar promoções',
        details: (err as Error).message,
      });
    }
  });

  return router;
}
