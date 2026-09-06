export type DetectedMarketplace = "mercadolivre" | "shopee" | "amazon" | "tiktokshop" | "generic";

export interface MarketplaceDetection {
  marketplace: DetectedMarketplace;
  confidence: number;
  productId: string | null;
  shopId: string | null;
}

export function detectMarketplace(url: string, documentTitle = "", hostnameOverride?: string): MarketplaceDetection {
  try {
    const parsed = new URL(url);
    const hostname = (hostnameOverride || parsed.hostname).toLowerCase();
    const pathname = parsed.pathname;

    // 1. Shopee
    if (hostname.includes("shopee.")) {
      const iMatch = pathname.match(/-i\.(\d+)\.(\d+)/);
      if (iMatch) {
        return { marketplace: "shopee", confidence: 1.0, shopId: iMatch[1], productId: iMatch[2] };
      }
      const pMatch = pathname.match(/\/product\/(\d+)\/(\d+)/);
      if (pMatch) {
        return { marketplace: "shopee", confidence: 1.0, shopId: pMatch[1], productId: pMatch[2] };
      }
      return { marketplace: "shopee", confidence: 0.8, shopId: null, productId: null };
    }

    // 2. Mercado Livre
    if (hostname.includes("mercadolivre.com") || hostname.includes("mercadolibre.com")) {
      const mlbMatch = pathname.match(/(MLB-?\d+)/i);
      const itemId = mlbMatch ? mlbMatch[1].replace("-", "") : null;
      return { marketplace: "mercadolivre", confidence: itemId ? 1.0 : 0.85, shopId: null, productId: itemId };
    }

    // 3. Amazon
    if (hostname.includes("amazon.")) {
      const asinMatch = pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      const asin = asinMatch ? asinMatch[1] : null;
      return { marketplace: "amazon", confidence: asin ? 1.0 : 0.85, shopId: null, productId: asin };
    }

    // 4. TikTok Shop
    if (hostname.includes("tiktok.com")) {
      const ttMatch = pathname.match(/\/product\/(\d+)/i);
      const ttId = ttMatch ? ttMatch[1] : null;
      return { marketplace: "tiktokshop", confidence: ttId ? 1.0 : 0.8, shopId: null, productId: ttId };
    }

    return { marketplace: "generic", confidence: 0.6, shopId: null, productId: "GEN_ITEM" };
  } catch {
    return { marketplace: "generic", confidence: 0.3, shopId: null, productId: null };
  }
}
