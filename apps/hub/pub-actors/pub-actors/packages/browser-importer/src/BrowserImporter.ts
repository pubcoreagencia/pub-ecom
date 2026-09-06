import { ProductImportSession } from "./ProductImportSession.js";
import { ImportValidator, VisualMatchAudit } from "./ImportValidator.js";
import { PreviewBuilder, BrowserImportPreview } from "./PreviewBuilder.js";
import { DestinationPayloadBuilder, DestinationPayloads } from "./DestinationPayloadBuilder.js";
import { BrowserCollector, BrowserCollectorOutput } from "../../browser-collector/src/BrowserCollector.js";
import { PubEcomProduct } from "../../actor-core/src/canonical.js";

export interface BrowserImportResult {
  session: ProductImportSession;
  collectorOutput: BrowserCollectorOutput;
  canonicalProduct: PubEcomProduct | null;
  preview: BrowserImportPreview | null;
  destinationPayloads: DestinationPayloads | null;
  visualAudit?: VisualMatchAudit;
  zeroMockApproved: boolean;
  status: "SUCCESS" | "INCOMPLETE" | "INVALID" | "FAILED";
}

export class BrowserImporter {
  /**
   * Runs the complete browser import pipeline from an active window context
   */
  static importFromWindow(url: string, windowObj: any, visualSample?: { title?: string; price?: number; imagesCount?: number }): BrowserImportResult {
    const session = new ProductImportSession();
    session.sourceUrl = url;
    const startTotal = Date.now();

    // 1. Detecting & Collecting
    session.transitionTo("COLLECTING");
    const tCollectStart = Date.now();
    const collectorOutput = BrowserCollector.collectFromBrowserContext(url, windowObj);
    session.metrics.collectionMs = Date.now() - tCollectStart;
    session.marketplace = collectorOutput.marketplace;

    // 2. Normalizing
    session.transitionTo("NORMALIZING");
    const tNormStart = Date.now();
    const canonical = collectorOutput.canonicalProduct;
    session.metrics.normalizationMs = Date.now() - tNormStart;

    // 3. Validating
    session.transitionTo("VALIDATING");
    const tValStart = Date.now();
    const valResult = ImportValidator.validate(collectorOutput.auditedProduct, canonical);
    session.metrics.validationMs = Date.now() - tValStart;

    if (!valResult.isValid || !canonical) {
      session.transitionTo(valResult.status === "INVALID" ? "INVALID" : "INCOMPLETE");
      session.recordError(valResult.error || "Validação do produto falhou");
      session.metrics.totalMs = Date.now() - startTotal;
      return {
        session,
        collectorOutput,
        canonicalProduct: null,
        preview: null,
        destinationPayloads: null,
        zeroMockApproved: valResult.zeroMockApproved,
        status: valResult.status === "INVALID" ? "INVALID" : "INCOMPLETE",
      };
    }

    // Visual match audit if provided
    let visualAudit: VisualMatchAudit | undefined;
    if (visualSample) {
      visualAudit = ImportValidator.auditVisualMatch(visualSample, {
        title: canonical.title,
        price: canonical.price,
        imagesCount: canonical.images.length,
      });
    }

    // 4. Preview Ready
    session.transitionTo("PREVIEW_READY");
    const tPrevStart = Date.now();
    const preview = PreviewBuilder.build(canonical, 40);
    session.metrics.previewMs = Date.now() - tPrevStart;

    // 5. Export Ready (Destination Payloads)
    session.transitionTo("EXPORT_READY");
    const tDestStart = Date.now();
    const destinationPayloads = DestinationPayloadBuilder.build(canonical, preview.suggestedSalePriceBrl);
    session.metrics.payloadGenerationMs = Date.now() - tDestStart;

    session.metrics.totalMs = Date.now() - startTotal;

    return {
      session,
      collectorOutput,
      canonicalProduct: canonical,
      preview,
      destinationPayloads,
      visualAudit,
      zeroMockApproved: true,
      status: "SUCCESS",
    };
  }
}
