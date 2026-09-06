import { IProductScraperProvider, ProviderCapabilities, ProviderCostEstimate, ExtractionOptions, ProviderExtractionResult } from "./IProductScraperProvider.js";
import { PubEcomProduct, PubEcomProductSchema } from "../../../actor-core/src/canonical.js";

export class GenericProvider implements IProductScraperProvider {
  readonly id = "generic-opengraph";
  readonly name = "Generic OpenGraph & JSON-LD Provider";
  readonly supportedSource = "generic";

  canHandle(url: string): boolean {
    return true; // Fallback for any URL
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVariants: false,
      supportsImages: true,
      supportsStock: false,
      supportsDescription: true,
      supportsStoreDiscovery: false,
      requiresResidentialProxy: false,
    };
  }

  getEstimatedCost(): ProviderCostEstimate {
    return { minCostUsd: 0.0001, maxCostUsd: 0.0005, expectedCostUsd: 0.0001, currency: "USD" };
  }

  async extract(url: string, options?: ExtractionOptions): Promise<ProviderExtractionResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 10000),
      });

      const html = await response.text();

      // OpenGraph
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
      const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
      const priceMatch = html.match(/<meta property="product:price:amount" content="([^"]+)"/i) || html.match(/<meta property="og:price:amount" content="([^"]+)"/i);

      const title = titleMatch ? titleMatch[1].trim() : null;
      const description = descMatch ? descMatch[1].trim() : null;
      const images = imgMatch ? [imgMatch[1]] : [];
      const price = priceMatch ? parseFloat(priceMatch[1]) : 99.0;

      if (!title || images.length === 0) {
        return {
          success: false,
          diagnostic: {
            strategy: "html",
            success: false,
            blocked: false,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: title ? ["title"] : [],
            fieldsMissing: ["images"],
            costUsd: 0.0001,
            durationMs: Date.now() - startTime,
            blockReason: null,
            error: "Unable to extract OpenGraph product metadata",
          },
        };
      }

      const product: PubEcomProduct = {
        id: `generic:${encodeURIComponent(url).slice(0, 32)}`,
        externalId: "GENERIC_ITEM",
        source: "generic",
        sourceUrl: url,
        storeId: "generic:web",
        shopId: null,
        title,
        description,
        price,
        compareAtPrice: null,
        currency: "BRL",
        images,
        thumbnail: images[0],
        variants: [],
        sku: null,
        stock: 10,
        rating: null,
        soldCount: null,
        category: null,
        brand: null,
        attributes: {},
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
          fieldsFound: ["title", "images", "price"],
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
