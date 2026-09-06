import { IProductScraperProvider, ProviderCapabilities, ProviderCostEstimate, ExtractionOptions, ProviderExtractionResult } from "./IProductScraperProvider.js";
import { UrlDetector } from "../detector/url-detector.js";
import { PubEcomProduct, PubEcomProductSchema } from "../../../actor-core/src/canonical.js";

export class AmazonProvider implements IProductScraperProvider {
  readonly id = "amazon-core";
  readonly name = "Amazon Core Provider";
  readonly supportedSource = "amazon";

  canHandle(url: string): boolean {
    const detection = UrlDetector.detect(url);
    return detection.source === "amazon";
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVariants: true,
      supportsImages: true,
      supportsStock: false,
      supportsDescription: true,
      supportsStoreDiscovery: false,
      requiresResidentialProxy: false,
    };
  }

  getEstimatedCost(): ProviderCostEstimate {
    return { minCostUsd: 0.0001, maxCostUsd: 0.002, expectedCostUsd: 0.0005, currency: "USD" };
  }

  async extract(url: string, options?: ExtractionOptions): Promise<ProviderExtractionResult> {
    const startTime = Date.now();
    const detection = UrlDetector.detect(url);
    const asin = detection.itemId;

    if (!asin) {
      return {
        success: false,
        diagnostic: {
          strategy: "html",
          success: false,
          blocked: false,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: [],
          fieldsMissing: ["asin"],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: "Invalid Amazon URL: ASIN not found",
        },
      };
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 15000),
      });

      const html = await response.text();

      // Check Amazon Bot Detection
      if (html.includes("api-services-support@amazon.com") || html.includes("Type the characters you see in this image")) {
        return {
          success: false,
          diagnostic: {
            strategy: "html",
            success: false,
            blocked: true,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: ["asin"],
            fieldsMissing: ["title", "price", "images"],
            costUsd: 0.0001,
            durationMs: Date.now() - startTime,
            blockReason: "Amazon CAPTCHA Challenge / Bot Interstitial",
            error: "Amazon bot defense detected.",
          },
        };
      }

      // Title
      const titleMatch = html.match(/<span id="productTitle"[^>]*>([\s\S]*?)<\/span>/i);
      const title = titleMatch ? titleMatch[1].trim() : null;

      // Price
      let price: number | null = null;
      const priceWholeMatch = html.match(/class="a-price-whole"[^>]*>([\d.,]+)/i);
      const priceFractionMatch = html.match(/class="a-price-fraction"[^>]*>([\d]+)/i);
      if (priceWholeMatch) {
        const whole = priceWholeMatch[1].replace(/[^0-9]/g, "");
        const frac = priceFractionMatch ? priceFractionMatch[1] : "00";
        price = parseFloat(`${whole}.${frac}`);
      }

      // Images
      const images: string[] = [];
      const imgMatch = html.match(/data-old-hires="([^"]+)"/i) || html.match(/id="landingImage"[^>]*src="([^"]+)"/i);
      if (imgMatch) images.push(imgMatch[1]);

      if (!title || !price || images.length === 0) {
        return {
          success: false,
          diagnostic: {
            strategy: "html",
            success: false,
            blocked: false,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: title ? ["title"] : [],
            fieldsMissing: ["price", "images"],
            costUsd: 0.0001,
            durationMs: Date.now() - startTime,
            blockReason: null,
            error: "Incomplete Amazon product fields",
          },
        };
      }

      const product: PubEcomProduct = {
        id: `amazon:${asin}`,
        externalId: asin,
        source: "amazon",
        sourceUrl: url,
        storeId: "amazon:br",
        shopId: null,
        title,
        description: null,
        price,
        compareAtPrice: null,
        currency: "BRL",
        images,
        thumbnail: images[0],
        variants: [],
        sku: asin,
        stock: 50,
        rating: null,
        soldCount: null,
        category: null,
        brand: "Amazon",
        attributes: { asin },
        metadata: { provider: this.id },
        extractionLevel: "level1_html",
        extractedAt: new Date().toISOString(),
      };

      return {
        success: true,
        product,
        diagnostic: {
          strategy: "html",
          success: true,
          blocked: false,
          recordsFound: 1,
          recordsValid: 1,
          fieldsFound: ["title", "price", "images", "asin"],
          fieldsMissing: [],
          costUsd: 0.0001,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: null,
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
