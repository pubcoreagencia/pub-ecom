import { UrlImportRouter, UrlImportAnalyzeResult } from "./UrlImportRouter.js";
import { PreviewBuilder, BrowserImportPreview } from "../../browser-importer/src/PreviewBuilder.js";
import { InternalImportService, ImportResponsePayload } from "../../browser-importer/src/InternalImportService.js";
import { PubEcomProduct } from "../../actor-core/src/canonical.js";

export interface UrlImportServiceAnalyzeResponse {
  success: boolean;
  provider: string;
  strategyUsed: string;
  durationMs: number;
  product: PubEcomProduct | null;
  preview: BrowserImportPreview | null;
  provenance: Record<string, { value: any; source: string }>;
  warnings: string[];
  error?: string;
}

export class UrlImportService {
  /**
   * Step 1: Analyze URL and generate preview
   */
  static async analyzeUrl(url: string, markupPercent = 40): Promise<UrlImportServiceAnalyzeResponse> {
    const analyzeResult: UrlImportAnalyzeResult = await UrlImportRouter.analyzeUrl(url);

    if (!analyzeResult.success || !analyzeResult.product) {
      return {
        success: false,
        provider: analyzeResult.provider,
        strategyUsed: analyzeResult.strategyUsed,
        durationMs: analyzeResult.durationMs,
        product: null,
        preview: null,
        provenance: analyzeResult.provenance,
        warnings: analyzeResult.warnings,
        error: analyzeResult.error || "Falha na análise do produto.",
      };
    }

    const preview = PreviewBuilder.build(analyzeResult.product, markupPercent);

    return {
      success: true,
      provider: analyzeResult.provider,
      strategyUsed: analyzeResult.strategyUsed,
      durationMs: analyzeResult.durationMs,
      product: analyzeResult.product,
      preview,
      provenance: analyzeResult.provenance,
      warnings: analyzeResult.warnings,
    };
  }

  /**
   * Step 2: Commit verified product into PUB ECOM internal catalog
   */
  static async commitImport(params: {
    product: PubEcomProduct;
    tenantId: string;
    userId?: string;
    featureFlagEnabled?: boolean;
    authToken?: string;
    expectedToken?: string;
  }): Promise<ImportResponsePayload> {
    return await InternalImportService.importProduct({
      product: params.product,
      importSource: "browser",
      tenantId: params.tenantId,
      userId: params.userId,
    }, {
      featureFlagEnabled: params.featureFlagEnabled ?? true,
      authToken: params.authToken,
      expectedToken: params.expectedToken,
    });
  }
}
