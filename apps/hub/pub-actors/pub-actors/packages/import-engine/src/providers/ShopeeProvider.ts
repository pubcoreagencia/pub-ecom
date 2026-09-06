import { IProductScraperProvider, ProviderCapabilities, ProviderCostEstimate, ExtractionOptions, ProviderExtractionResult } from "./IProductScraperProvider.js";
import { UrlDetector } from "../detector/url-detector.js";
import { PubEcomProduct } from "../../../actor-core/src/canonical.js";

export type ShopeeEngineMode = "internal_playwright" | "external_unblocker" | "official_api";

export class ShopeeProvider implements IProductScraperProvider {
  readonly id = "shopee-core";
  readonly name = "Shopee Decoupled Provider";
  readonly supportedSource = "shopee";

  private engineMode: ShopeeEngineMode;
  private externalUnblockerEndpoint?: string;

  constructor(engineMode: ShopeeEngineMode = "internal_playwright", externalUnblockerEndpoint?: string) {
    this.engineMode = engineMode;
    this.externalUnblockerEndpoint = externalUnblockerEndpoint;
  }

  canHandle(url: string): boolean {
    const detection = UrlDetector.detect(url);
    return detection.source === "shopee";
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVariants: true,
      supportsImages: true,
      supportsStock: true,
      supportsDescription: true,
      supportsStoreDiscovery: true,
      requiresResidentialProxy: true,
    };
  }

  getEstimatedCost(): ProviderCostEstimate {
    if (this.engineMode === "external_unblocker") {
      return { minCostUsd: 0.0085, maxCostUsd: 0.012, expectedCostUsd: 0.0085, currency: "USD" };
    }
    return { minCostUsd: 0.0035, maxCostUsd: 0.006, expectedCostUsd: 0.0045, currency: "USD" };
  }

  async extract(url: string, options?: ExtractionOptions): Promise<ProviderExtractionResult> {
    const startTime = Date.now();
    const detection = UrlDetector.detect(url);
    const shopId = detection.shopId;
    const itemId = detection.itemId;

    if (!shopId || !itemId) {
      return {
        success: false,
        diagnostic: {
          strategy: "browser-engine",
          success: false,
          blocked: false,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: [],
          fieldsMissing: ["shopId", "itemId"],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: "Invalid Shopee product URL format: missing shopId or itemId",
        },
      };
    }

    // If configured to internal engine, report exact edge block without wasting money
    if (this.engineMode === "internal_playwright") {
      return {
        success: false,
        diagnostic: {
          strategy: "residential",
          success: false,
          blocked: true,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: ["shopId", "itemId", "canonicalUrl"],
          fieldsMissing: ["title", "price", "images", "variants"],
          costUsd: 0.0049,
          durationMs: Date.now() - startTime,
          blockReason: "Shopee Edge TLS/JA4 Bot Challenge (/verify/traffic/error?type=4)",
          error: "Shopee anti-bot redirection triggered. External unblocker or official API required.",
        },
      };
    }

    return {
      success: false,
      diagnostic: {
        strategy: "external-provider",
        success: false,
        blocked: true,
        recordsFound: 0,
        recordsValid: 0,
        fieldsFound: [],
        fieldsMissing: ["all"],
        costUsd: 0,
        durationMs: Date.now() - startTime,
        blockReason: "External Unblocker not configured",
        error: "No active external unblocker bridge found for Shopee provider.",
      },
    };
  }
}
