import { z } from "zod";

export const DetectedSourceSchema = z.enum([
  "shopee",
  "mercadolivre",
  "amazon",
  "aliexpress",
  "tiktokshop",
  "generic",
]);

export type DetectedSource = z.infer<typeof DetectedSourceSchema>;

export const UrlDetectionResultSchema = z.object({
  url: z.string().url(),
  canonicalUrl: z.string().url(),
  source: DetectedSourceSchema,
  productType: z.string(),
  shopId: z.string().nullable(),
  itemId: z.string().nullable(),
  username: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  isStoreUrl: z.boolean(),
  isProductUrl: z.boolean(),
});

export type UrlDetectionResult = z.infer<typeof UrlDetectionResultSchema>;

export class UrlDetector {
  /**
   * Detects the marketplace source and extracts IDs from a given URL
   */
  static detect(rawUrl: string): UrlDetectionResult {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new Error(`Invalid URL format: ${rawUrl}`);
    }

    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 1. SHOPEE
    if (hostname.includes("shopee.com") || hostname.includes("shopee.com.br") || hostname.includes("s.shopee.com.br")) {
      const iMatch = pathname.match(/-i\.(\d+)\.(\d+)/);
      if (iMatch) {
        return {
          url: rawUrl,
          canonicalUrl: `https://shopee.com.br/product/${iMatch[1]}/${iMatch[2]}`,
          source: "shopee",
          productType: "standard",
          shopId: iMatch[1],
          itemId: iMatch[2],
          username: null,
          confidence: 1.0,
          isStoreUrl: false,
          isProductUrl: true,
        };
      }

      const prodMatch = pathname.match(/\/product\/(\d+)\/(\d+)/);
      if (prodMatch) {
        return {
          url: rawUrl,
          canonicalUrl: `https://shopee.com.br/product/${prodMatch[1]}/${prodMatch[2]}`,
          source: "shopee",
          productType: "standard",
          shopId: prodMatch[1],
          itemId: prodMatch[2],
          username: null,
          confidence: 1.0,
          isStoreUrl: false,
          isProductUrl: true,
        };
      }

      const segments = pathname.split("/").filter(Boolean);
      if (segments.length === 1 && !segments[0].includes(".")) {
        return {
          url: rawUrl,
          canonicalUrl: `https://shopee.com.br/${segments[0]}`,
          source: "shopee",
          productType: "store",
          shopId: null,
          itemId: null,
          username: segments[0],
          confidence: 0.95,
          isStoreUrl: true,
          isProductUrl: false,
        };
      }

      return {
        url: rawUrl,
        canonicalUrl: rawUrl,
        source: "shopee",
        productType: "unknown",
        shopId: null,
        itemId: null,
        username: null,
        confidence: 0.7,
        isStoreUrl: false,
        isProductUrl: false,
      };
    }

    // 2. TIKTOK SHOP
    if (hostname.includes("tiktok.com") || hostname.includes("shop.tiktok.com") || hostname.includes("vt.tiktok.com")) {
      // Pattern 1: /view/product/1729482910485729104
      const viewProductMatch = pathname.match(/\/view\/product\/(\d+)/i);
      if (viewProductMatch) {
        return {
          url: rawUrl,
          canonicalUrl: `https://shop.tiktok.com/view/product/${viewProductMatch[1]}`,
          source: "tiktokshop",
          productType: "standard",
          shopId: null,
          itemId: viewProductMatch[1],
          username: null,
          confidence: 1.0,
          isStoreUrl: false,
          isProductUrl: true,
        };
      }

      // Pattern 2: /@seller/product/1729482910485729104
      const sellerProductMatch = pathname.match(/@([^/]+)\/product\/(\d+)/i);
      if (sellerProductMatch) {
        return {
          url: rawUrl,
          canonicalUrl: `https://shop.tiktok.com/@${sellerProductMatch[1]}/product/${sellerProductMatch[2]}`,
          source: "tiktokshop",
          productType: "standard",
          shopId: null,
          itemId: sellerProductMatch[2],
          username: sellerProductMatch[1],
          confidence: 1.0,
          isStoreUrl: false,
          isProductUrl: true,
        };
      }

      // Pattern 3: /product/1729482910485729104
      const simpleProductMatch = pathname.match(/\/product\/(\d+)/i);
      if (simpleProductMatch) {
        return {
          url: rawUrl,
          canonicalUrl: `https://shop.tiktok.com/view/product/${simpleProductMatch[1]}`,
          source: "tiktokshop",
          productType: "standard",
          shopId: null,
          itemId: simpleProductMatch[1],
          username: null,
          confidence: 1.0,
          isStoreUrl: false,
          isProductUrl: true,
        };
      }

      // Pattern 4: /store/{shopId} or @seller shop page
      const storeMatch = pathname.match(/@([^/]+)/i);
      if (storeMatch && !pathname.includes("/product/")) {
        return {
          url: rawUrl,
          canonicalUrl: `https://www.tiktok.com/@${storeMatch[1]}`,
          source: "tiktokshop",
          productType: "store",
          shopId: null,
          itemId: null,
          username: storeMatch[1],
          confidence: 0.9,
          isStoreUrl: true,
          isProductUrl: false,
        };
      }

      return {
        url: rawUrl,
        canonicalUrl: rawUrl,
        source: "tiktokshop",
        productType: "generic_tiktok",
        shopId: null,
        itemId: null,
        username: null,
        confidence: 0.7,
        isStoreUrl: false,
        isProductUrl: false,
      };
    }

    // 3. MERCADO LIVRE
    if (hostname.includes("mercadolivre.com") || hostname.includes("mercadolibre.com") || hostname.includes("produto.mercadolivre.com.br")) {
      const mlbMatch = pathname.match(/(MLB-?\d+)/i);
      const itemId = mlbMatch ? mlbMatch[1].replace("-", "") : null;

      return {
        url: rawUrl,
        canonicalUrl: itemId ? `https://produto.mercadolivre.com.br/${itemId}` : rawUrl,
        source: "mercadolivre",
        productType: "standard",
        shopId: null,
        itemId,
        username: null,
        confidence: itemId ? 1.0 : 0.8,
        isStoreUrl: pathname.includes("/loja/") || pathname.includes("/pagina/"),
        isProductUrl: !!itemId,
      };
    }

    // 4. AMAZON
    if (hostname.includes("amazon.com") || hostname.includes("amazon.com.br")) {
      const asinMatch = pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      const itemId = asinMatch ? asinMatch[1] : null;

      return {
        url: rawUrl,
        canonicalUrl: itemId ? `https://www.amazon.com.br/dp/${itemId}` : rawUrl,
        source: "amazon",
        productType: "standard",
        shopId: null,
        itemId,
        username: null,
        confidence: itemId ? 1.0 : 0.75,
        isStoreUrl: pathname.includes("/stores/"),
        isProductUrl: !!itemId,
      };
    }

    // 5. ALIEXPRESS
    if (hostname.includes("aliexpress.com") || hostname.includes("pt.aliexpress.com")) {
      const aliMatch = pathname.match(/\/item\/(\d+)\.html/i);
      const itemId = aliMatch ? aliMatch[1] : null;

      return {
        url: rawUrl,
        canonicalUrl: itemId ? `https://pt.aliexpress.com/item/${itemId}.html` : rawUrl,
        source: "aliexpress",
        productType: "standard",
        shopId: null,
        itemId,
        username: null,
        confidence: itemId ? 1.0 : 0.8,
        isStoreUrl: pathname.includes("/store/"),
        isProductUrl: !!itemId,
      };
    }

    // 6. GENERIC URL
    return {
      url: rawUrl,
      canonicalUrl: rawUrl,
      source: "generic",
      productType: "generic_page",
      shopId: null,
      itemId: null,
      username: null,
      confidence: 0.5,
      isStoreUrl: false,
      isProductUrl: true,
    };
  }
}
