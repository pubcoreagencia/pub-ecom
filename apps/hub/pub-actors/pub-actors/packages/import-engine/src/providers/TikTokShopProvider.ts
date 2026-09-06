import { IProductScraperProvider, ProviderCapabilities, ProviderCostEstimate, ExtractionOptions, ProviderExtractionResult } from "./IProductScraperProvider.js";
import { TikTokShopOfficialProvider, TikTokShopOfficialConfig } from "./TikTokShopOfficialProvider.js";
import { UrlDetector } from "../detector/url-detector.js";
import { PubEcomProduct, PubEcomProductSchema } from "../../../actor-core/src/canonical.js";

export type TikTokShopMode = "auto" | "official_api" | "web";

export class TikTokShopProvider implements IProductScraperProvider {
  readonly id = "tiktokshop-core";
  readonly name = "TikTok Shop Core Orchestrator Provider";
  readonly supportedSource = "tiktokshop";

  private officialProvider: TikTokShopOfficialProvider;
  private mode: TikTokShopMode;

  constructor(mode: TikTokShopMode = "auto", officialConfig: TikTokShopOfficialConfig = {}) {
    this.mode = mode;
    this.officialProvider = new TikTokShopOfficialProvider(officialConfig);
  }

  canHandle(url: string): boolean {
    const detection = UrlDetector.detect(url);
    return detection.source === "tiktokshop";
  }

  getCapabilities(): ProviderCapabilities {
    return this.officialProvider.hasValidCredentials()
      ? this.officialProvider.getCapabilities()
      : {
          supportsVariants: true,
          supportsImages: true,
          supportsStock: false,
          supportsDescription: true,
          supportsStoreDiscovery: true,
          requiresResidentialProxy: true,
        };
  }

  getEstimatedCost(): ProviderCostEstimate {
    if (this.mode === "official_api" || (this.mode === "auto" && this.officialProvider.hasValidCredentials())) {
      return this.officialProvider.getEstimatedCost();
    }
    return {
      minCostUsd: 0.0001,
      maxCostUsd: 0.0050,
      expectedCostUsd: 0.0020,
      currency: "USD",
    };
  }

  async extract(url: string, options?: ExtractionOptions): Promise<ProviderExtractionResult> {
    // Mode 1: If official API credentials exist and mode is not forced to web, try official API
    if (this.mode === "official_api" || (this.mode === "auto" && this.officialProvider.hasValidCredentials())) {
      const officialResult = await this.officialProvider.extract(url, options);
      if (officialResult.success && officialResult.product) {
        return officialResult;
      }
      if (this.mode === "official_api") {
        return officialResult;
      }
    }

    // Mode 2: Web Extraction fallback
    const startTime = Date.now();
    const detection = UrlDetector.detect(url);
    const productId = detection.itemId || "TT_PRODUCT";
    const shopId = detection.shopId;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 15000),
      });

      const currentUrl = response.url;
      const html = await response.text();

      const isBlocked = currentUrl.includes("/verify/") || 
                        currentUrl.includes("captcha") || 
                        html.includes("verify-bar") || 
                        html.includes("security-check") || 
                        html.includes("bytedance.com/captcha");

      if (isBlocked) {
        return {
          success: false,
          diagnostic: {
            strategy: "html",
            success: false,
            blocked: true,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: ["productId"],
            fieldsMissing: ["title", "price", "images"],
            costUsd: 0.0001,
            durationMs: Date.now() - startTime,
            blockReason: "TikTok Shop Edge Bot / Captcha Verification Challenge",
            error: "Blocked by TikTok anti-automation verification",
          },
        };
      }

      let title: string | null = null;
      let description: string | null = null;
      let price: number | null = null;
      let compareAtPrice: number | null = null;
      let images: string[] = [];
      let variants: any[] = [];
      let stock: number | null = null;
      let rating: number | null = null;
      let soldCount: number | null = null;
      let brand: string | null = null;
      let category: string | null = null;
      let extractionLevel = "level1_html";

      const hydrationMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i) ||
                             html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i);

      if (hydrationMatch) {
        try {
          const parsedData = JSON.parse(hydrationMatch[1]);
          const productDetail = parsedData.__DEFAULT_SCOPE__?.["webapp.product-detail"]?.productInfo ||
                                parsedData.ProductModule?.productDetail ||
                                parsedData.productInfo;

          if (productDetail) {
            extractionLevel = "level2_hydration";
            title = productDetail.title || productDetail.name || title;
            description = productDetail.description || description;
            brand = productDetail.brandName || brand;
            category = productDetail.categoryName || category;

            if (productDetail.price) {
              price = parseFloat(productDetail.price.minRealPrice || productDetail.price.realPrice || productDetail.price.originalPrice || 0);
              compareAtPrice = productDetail.price.originalPrice ? parseFloat(productDetail.price.originalPrice) : null;
            }

            if (Array.isArray(productDetail.images)) {
              images = productDetail.images.map((img: any) => typeof img === "string" ? img : img.url || img.urlList?.[0]).filter(Boolean);
            }

            if (Array.isArray(productDetail.skus)) {
              variants = productDetail.skus.map((sku: any, i: number) => ({
                id: String(sku.id || i + 1),
                name: sku.name || sku.specValues?.map((s: any) => s.value).join(" / ") || `Opção ${i + 1}`,
                price: parseFloat(sku.price?.realPrice || price || 0),
                compareAtPrice: sku.price?.originalPrice ? parseFloat(sku.price.originalPrice) : null,
                sku: sku.sellerSku || null,
                stock: sku.stock ?? null,
                image: sku.image?.url || null,
              }));
            }

            stock = productDetail.stock ?? stock;
            rating = productDetail.rating ? parseFloat(productDetail.rating) : rating;
            soldCount = productDetail.soldCount ? parseInt(productDetail.soldCount, 10) : soldCount;
          }
        } catch {}
      }

      if (!title) {
        const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
        if (ogTitle) title = ogTitle[1].replace(/\|\s*TikTok.*$/i, "").trim();
      }
      if (!description) {
        const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/i);
        if (ogDesc) description = ogDesc[1].trim();
      }
      if (images.length === 0) {
        const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
        if (ogImage) images.push(ogImage[1]);
      }
      if (!price) {
        const priceMatch = html.match(/"realPrice":"([\d.]+)"/i) || html.match(/R\$\s*([\d.,]+)/i);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
        }
      }

      const fieldsFound: string[] = [];
      const fieldsMissing: string[] = [];

      if (title) fieldsFound.push("title"); else fieldsMissing.push("title");
      if (price) fieldsFound.push("price"); else fieldsMissing.push("price");
      if (images.length > 0) fieldsFound.push("images"); else fieldsMissing.push("images");
      if (description) fieldsFound.push("description");
      if (variants.length > 0) fieldsFound.push("variants");

      if (!title || !price || images.length === 0) {
        return {
          success: false,
          diagnostic: {
            strategy: "html",
            success: false,
            blocked: false,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound,
            fieldsMissing,
            costUsd: 0.0001,
            durationMs: Date.now() - startTime,
            blockReason: null,
            error: `Incomplete TikTok Shop extraction. Missing: ${fieldsMissing.join(", ")}`,
          },
        };
      }

      const canonicalProduct: PubEcomProduct = {
        id: `tiktokshop:${shopId || "default"}:${productId}`,
        externalId: String(productId),
        source: "tiktokshop",
        sourceUrl: url,
        storeId: shopId ? `tiktokshop:${shopId}` : "tiktokshop:default",
        shopId: shopId || null,
        title: title.trim(),
        description: description ? description.trim() : null,
        price,
        compareAtPrice,
        currency: "BRL",
        images: images.filter((img) => typeof img === "string" && img.startsWith("http")),
        thumbnail: images[0] || null,
        variants,
        sku: productId,
        stock: stock ?? 50,
        rating,
        soldCount,
        category,
        brand,
        attributes: {
          marketplace: "tiktokshop",
          productId,
        },
        metadata: {
          provider: this.id,
          extractionLevel,
        },
        extractionLevel,
        extractedAt: new Date().toISOString(),
      };

      const validation = PubEcomProductSchema.safeParse(canonicalProduct);
      return {
        success: validation.success,
        product: validation.success ? validation.data : undefined,
        diagnostic: {
          strategy: "html",
          success: validation.success,
          blocked: false,
          recordsFound: 1,
          recordsValid: validation.success ? 1 : 0,
          fieldsFound: ["title", "price", "images"],
          fieldsMissing: [],
          costUsd: 0.0001,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: validation.success ? null : validation.error.message,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        diagnostic: {
          strategy: "html",
          success: false,
          blocked: false,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: [],
          fieldsMissing: ["all"],
          costUsd: 0.0001,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: err?.message || String(err),
        },
      };
    }
  }
}
