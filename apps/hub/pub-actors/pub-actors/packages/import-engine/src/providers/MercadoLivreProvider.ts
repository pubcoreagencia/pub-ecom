import { IProductScraperProvider, ProviderCapabilities, ProviderCostEstimate, ExtractionOptions, ProviderExtractionResult } from "./IProductScraperProvider.js";
import { MercadoLivreOfficialProvider, MercadoLivreOfficialConfig } from "./MercadoLivreOfficialProvider.js";
import { PubEcomProduct, PubEcomProductSchema } from "../../../actor-core/src/canonical.js";
import { UrlDetector } from "../detector/url-detector.js";

export type MercadoLivreMode = "auto" | "official_api" | "web";

export class MercadoLivreProvider implements IProductScraperProvider {
  readonly id = "mercadolivre-core";
  readonly name = "Mercado Livre Core Orchestrator Provider";
  readonly supportedSource = "mercadolivre";

  private officialProvider: MercadoLivreOfficialProvider;
  private mode: MercadoLivreMode;

  constructor(mode: MercadoLivreMode = "auto", officialConfig: MercadoLivreOfficialConfig = {}) {
    this.mode = mode;
    this.officialProvider = new MercadoLivreOfficialProvider(officialConfig);
  }

  canHandle(url: string): boolean {
    const detection = UrlDetector.detect(url);
    return detection.source === "mercadolivre";
  }

  getCapabilities(): ProviderCapabilities {
    return this.officialProvider.hasValidCredentials()
      ? this.officialProvider.getCapabilities()
      : {
          supportsVariants: true,
          supportsImages: true,
          supportsStock: true,
          supportsDescription: true,
          supportsStoreDiscovery: true,
          requiresResidentialProxy: false,
        };
  }

  getEstimatedCost(): ProviderCostEstimate {
    if (this.mode === "official_api" || (this.mode === "auto" && this.officialProvider.hasValidCredentials())) {
      return this.officialProvider.getEstimatedCost();
    }
    return {
      minCostUsd: 0.0001,
      maxCostUsd: 0.0015,
      expectedCostUsd: 0.0003,
      currency: "USD",
    };
  }

  async extract(url: string, options?: ExtractionOptions): Promise<ProviderExtractionResult> {
    // Mode 1: Official API if configured
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
    const itemId = detection.itemId || "MLB_ITEM";

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 15000),
      });

      const currentUrl = response.url;
      const html = await response.text();

      const isVerification = currentUrl.includes("account-verification") || 
                            currentUrl.includes("suspicious-traffic") ||
                            html.includes("suspicious-traffic-frontend") ||
                            response.status === 403;

      if (isVerification) {
        return {
          success: false,
          diagnostic: {
            strategy: "html",
            success: false,
            blocked: true,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: ["itemId"],
            fieldsMissing: ["title", "price", "images"],
            costUsd: 0.0001,
            durationMs: Date.now() - startTime,
            blockReason: "Mercado Livre Bot Interstitial (/gz/account-verification challenge)",
            error: "Blocked by Mercado Livre traffic verification. Configure MERCADOLIVRE_APP_ID for 100% official access.",
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

      // JSON-LD Parser
      const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches) {
        for (const tag of jsonLdMatches) {
          try {
            const rawJson = tag.replace(/<\/?script[^>]*>/gi, "");
            const parsed = JSON.parse(rawJson);
            if (parsed["@type"] === "Product" || parsed.name) {
              title = parsed.name || title;
              description = parsed.description || description;
              brand = parsed.brand?.name || brand;
              category = parsed.category || category;
              if (parsed.image) {
                images = Array.isArray(parsed.image) ? parsed.image : [parsed.image];
              }
              if (parsed.offers) {
                const offer = Array.isArray(parsed.offers) ? parsed.offers[0] : parsed.offers;
                price = parseFloat(offer.price || offer.lowPrice || 0);
              }
              if (parsed.aggregateRating) {
                rating = parseFloat(parsed.aggregateRating.ratingValue || 0);
                soldCount = parseInt(parsed.aggregateRating.reviewCount || 0, 10);
              }
            }
          } catch {}
        }
      }

      // OpenGraph Fallbacks
      if (!title) {
        const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
        if (ogTitle) title = ogTitle[1].replace(/\|.+$/, "").trim();
      }
      if (!description) {
        const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/i);
        if (ogDesc) description = ogDesc[1].trim();
      }
      if (images.length === 0) {
        const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
        if (ogImage) images.push(ogImage[1]);
      }

      const fieldsFound: string[] = [];
      const fieldsMissing: string[] = [];

      if (title) fieldsFound.push("title"); else fieldsMissing.push("title");
      if (price) fieldsFound.push("price"); else fieldsMissing.push("price");
      if (images.length > 0) fieldsFound.push("images"); else fieldsMissing.push("images");
      if (description) fieldsFound.push("description");

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
            error: `Incomplete Mercado Livre extraction. Missing: ${fieldsMissing.join(", ")}`,
          },
        };
      }

      const canonicalProduct: PubEcomProduct = {
        id: `mercadolivre:mlb:${itemId}`,
        externalId: String(itemId),
        source: "mercadolivre",
        sourceUrl: url,
        storeId: "mercadolivre:default",
        shopId: null,
        title: title.trim(),
        description: description ? description.trim() : null,
        price,
        compareAtPrice,
        currency: "BRL",
        images: images.filter((img) => typeof img === "string" && img.startsWith("http")),
        thumbnail: images[0] || null,
        variants,
        sku: itemId,
        stock: stock ?? 10,
        rating,
        soldCount,
        category,
        brand,
        attributes: { itemId },
        metadata: { provider: this.id },
        extractionLevel: "level1_html",
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
          fieldsFound,
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
          fieldsFound: ["itemId"],
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
