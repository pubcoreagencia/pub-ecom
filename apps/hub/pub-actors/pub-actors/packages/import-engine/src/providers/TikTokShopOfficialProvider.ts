import { IProductScraperProvider, ProviderCapabilities, ProviderCostEstimate, ExtractionOptions, ProviderExtractionResult } from "./IProductScraperProvider.js";
import { UrlDetector } from "../detector/url-detector.js";
import { PubEcomProduct, PubEcomProductSchema } from "../../../actor-core/src/canonical.js";

export interface TikTokShopOfficialConfig {
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  shopCipher?: string;
  region?: string; // 'US' | 'UK' | 'BR' | 'SEA'
}

export class TikTokShopOfficialProvider implements IProductScraperProvider {
  readonly id = "tiktokshop-official-api";
  readonly name = "TikTok Shop Official Open API Provider";
  readonly supportedSource = "tiktokshop";

  private config: TikTokShopOfficialConfig;

  constructor(config: TikTokShopOfficialConfig = {}) {
    this.config = {
      appKey: config.appKey || process.env.TIKTOK_SHOP_APP_KEY,
      appSecret: config.appSecret || process.env.TIKTOK_SHOP_APP_SECRET,
      accessToken: config.accessToken || process.env.TIKTOK_SHOP_ACCESS_TOKEN,
      shopCipher: config.shopCipher || process.env.TIKTOK_SHOP_CIPHER,
      region: config.region || process.env.TIKTOK_SHOP_REGION || "US",
    };
  }

  canHandle(url: string): boolean {
    const detection = UrlDetector.detect(url);
    return detection.source === "tiktokshop";
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVariants: true,
      supportsImages: true,
      supportsStock: true,
      supportsDescription: true,
      supportsStoreDiscovery: true,
      requiresResidentialProxy: false,
    };
  }

  getEstimatedCost(): ProviderCostEstimate {
    return {
      minCostUsd: 0.0000,
      maxCostUsd: 0.0001,
      expectedCostUsd: 0.0000, // Official API is free within rate limits
      currency: "USD",
    };
  }

  hasValidCredentials(): boolean {
    return !!(this.config.appKey && this.config.accessToken);
  }

  async extract(url: string, options?: ExtractionOptions): Promise<ProviderExtractionResult> {
    const startTime = Date.now();
    const detection = UrlDetector.detect(url);
    const productId = detection.itemId;

    if (!productId) {
      return {
        success: false,
        diagnostic: {
          strategy: "external-provider",
          success: false,
          blocked: false,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: [],
          fieldsMissing: ["productId"],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: "Invalid TikTok Shop URL: product ID could not be extracted",
        },
      };
    }

    // Step 1: Check if official credentials are provided server-side
    if (!this.hasValidCredentials()) {
      return {
        success: false,
        diagnostic: {
          strategy: "external-provider",
          success: false,
          blocked: true,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: ["productId"],
          fieldsMissing: ["appKey", "accessToken", "shopCipher"],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: "TikTok Shop Open API credentials not configured (Requires Partner App Key + Seller OAuth / Affiliate Token)",
          error: "Missing TIKTOK_SHOP_APP_KEY or TIKTOK_SHOP_ACCESS_TOKEN server configuration.",
        },
      };
    }

    try {
      // Step 2: Query TikTok Shop Product Detail API (v202309)
      const baseUrl = this.config.region === "US" 
        ? "https://open-api.tiktokglobalshop.com" 
        : "https://open-api.tiktokglobalshop.com";

      const endpoint = `${baseUrl}/product/202309/products/${productId}?shop_cipher=${this.config.shopCipher || ""}`;

      const response = await fetch(endpoint, {
        headers: {
          "x-tts-access-token": this.config.accessToken!,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 10000),
      });

      if (!response.ok) {
        return {
          success: false,
          diagnostic: {
            strategy: "external-provider",
            success: false,
            blocked: response.status === 401 || response.status === 403,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: ["productId"],
            fieldsMissing: ["productDetails"],
            costUsd: 0,
            durationMs: Date.now() - startTime,
            blockReason: `TikTok Shop API Error HTTP ${response.status}`,
            error: `API Request rejected by TikTok Shop: ${response.statusText}`,
          },
        };
      }

      const json = await response.json();
      const productData = json.data?.product;

      if (!productData) {
        return {
          success: false,
          diagnostic: {
            strategy: "external-provider",
            success: false,
            blocked: false,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: ["productId"],
            fieldsMissing: ["title", "price", "images"],
            costUsd: 0,
            durationMs: Date.now() - startTime,
            blockReason: null,
            error: json.message || "Product data not found in TikTok Shop API response",
          },
        };
      }

      const canonical: PubEcomProduct = {
        id: `tiktokshop:${this.config.shopCipher || "default"}:${productId}`,
        externalId: String(productId),
        source: "tiktokshop",
        sourceUrl: url,
        storeId: `tiktokshop:${this.config.shopCipher || "default"}`,
        shopId: this.config.shopCipher || null,
        title: productData.title,
        description: productData.description || null,
        price: parseFloat(productData.skus?.[0]?.price?.tax_exclusive_price || "0"),
        compareAtPrice: productData.skus?.[0]?.price?.original_price ? parseFloat(productData.skus[0].price.original_price) : null,
        currency: "BRL",
        images: productData.main_images?.map((img: any) => img.url_list?.[0]).filter(Boolean) || [],
        thumbnail: productData.main_images?.[0]?.url_list?.[0] || null,
        variants: (productData.skus || []).map((sku: any, i: number) => ({
          id: String(sku.id || i + 1),
          name: sku.sales_attributes?.map((a: any) => a.value_name).join(" / ") || `Opção ${i + 1}`,
          price: parseFloat(sku.price?.tax_exclusive_price || "0"),
          compareAtPrice: sku.price?.original_price ? parseFloat(sku.price.original_price) : null,
          sku: sku.seller_sku || null,
          stock: sku.inventory?.[0]?.quantity || null,
          image: sku.image?.url_list?.[0] || null,
        })),
        sku: productData.skus?.[0]?.seller_sku || productId,
        stock: productData.skus?.reduce((acc: number, s: any) => acc + (s.inventory?.[0]?.quantity || 0), 0) || null,
        rating: null,
        soldCount: null,
        category: productData.category_list?.[0]?.name || null,
        brand: productData.brand?.name || null,
        attributes: {
          officialApi: true,
          productId,
        },
        metadata: {
          provider: this.id,
        },
        extractionLevel: "official_api",
        extractedAt: new Date().toISOString(),
      };

      const validation = PubEcomProductSchema.safeParse(canonical);
      return {
        success: validation.success,
        product: validation.success ? validation.data : undefined,
        diagnostic: {
          strategy: "external-provider",
          success: validation.success,
          blocked: false,
          recordsFound: 1,
          recordsValid: validation.success ? 1 : 0,
          fieldsFound: ["title", "price", "images", "variants", "skus"],
          fieldsMissing: [],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: validation.success ? null : validation.error.message,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        diagnostic: {
          strategy: "external-provider",
          success: false,
          blocked: false,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: ["productId"],
          fieldsMissing: ["all"],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: err?.message || String(err),
        },
      };
    }
  }
}
