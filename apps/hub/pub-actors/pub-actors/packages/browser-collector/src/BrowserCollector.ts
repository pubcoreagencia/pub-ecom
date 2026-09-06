import { detectMarketplace, MarketplaceDetection } from "./marketplace-detector.js";
import { extractFromDom, DomExtractionResult } from "./dom-extractor.js";
import { extractFromJsonLd, JsonLdExtractionResult } from "./jsonld-extractor.js";
import { extractFromMeta, MetaExtractionResult } from "./meta-extractor.js";
import { extractFromHydration, HydrationExtractionResult } from "./hydration-extractor.js";
import { BrowserNormalizer, AuditedBrowserProduct } from "./normalizer.js";
import { PubEcomProduct } from "../../actor-core/src/canonical.js";

export interface BrowserCollectorOutput {
  status: "SUCCESS" | "PARTIAL" | "INCOMPLETE" | "BLOCKED";
  marketplace: string;
  url: string;
  productId: string | null;
  shopId: string | null;
  durationMs: number;
  auditedProduct: AuditedBrowserProduct;
  canonicalProduct: PubEcomProduct | null;
  sourcesFound: {
    dom: boolean;
    jsonld: boolean;
    meta: boolean;
    hydration: boolean;
    network: boolean;
  };
  totalRealFields: number;
  error?: string | null;
}

export class BrowserCollector {
  /**
   * Executes in browser context (window, document)
   */
  static collectFromBrowserContext(url: string, windowObj: any = typeof window !== "undefined" ? window : {}): BrowserCollectorOutput {
    const startTime = Date.now();
    const doc = windowObj.document || (typeof document !== "undefined" ? document : null);

    if (!doc) {
      throw new Error("BrowserCollector requires an active browser Document context");
    }

    // Step 1: Detect Marketplace
    const detection = detectMarketplace(url, doc.title || "");

    // Step 2: Extract Level 1 - DOM
    const domResult = extractFromDom(doc, detection.marketplace);

    // Step 3: Extract Level 2 - JSON-LD
    const jsonldResult = extractFromJsonLd(doc);

    // Step 4: Extract Level 3 - Meta Tags
    const metaResult = extractFromMeta(doc);

    // Step 5: Extract Level 4 - Hydration Data
    const hydrationResult = extractFromHydration(windowObj);

    // Step 6: Normalize with Provenance Tracking
    const normalized = BrowserNormalizer.normalize({
      detection,
      url,
      dom: domResult,
      jsonld: jsonldResult,
      meta: metaResult,
      hydration: hydrationResult,
    });

    const sourcesFound = {
      dom: Boolean(domResult.title || domResult.price || domResult.images.length > 0),
      jsonld: Boolean(jsonldResult.title || jsonldResult.price || jsonldResult.images.length > 0),
      meta: Boolean(metaResult.title || metaResult.price || metaResult.images.length > 0),
      hydration: Boolean(hydrationResult.title || hydrationResult.price || hydrationResult.foundHydrationKey),
      network: false,
    };

    let status: "SUCCESS" | "PARTIAL" | "INCOMPLETE" | "BLOCKED" = "INCOMPLETE";
    if (normalized.isValid && normalized.canonical) {
      status = "SUCCESS";
    } else if (normalized.audited.totalRealFields > 0) {
      status = "PARTIAL";
    }

    return {
      status,
      marketplace: detection.marketplace,
      url,
      productId: detection.productId,
      shopId: detection.shopId,
      durationMs: Date.now() - startTime,
      auditedProduct: normalized.audited,
      canonicalProduct: normalized.canonical,
      sourcesFound,
      totalRealFields: normalized.audited.totalRealFields,
      error: normalized.error || null,
    };
  }
}
