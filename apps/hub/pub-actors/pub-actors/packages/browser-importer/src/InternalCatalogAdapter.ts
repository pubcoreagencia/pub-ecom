import { PubEcomProduct } from "../../actor-core/src/canonical.js";
import { IDestinationAdapter, DestinationExportOptions, ExportResult } from "../../actor-core/src/adapters.js";

export class InternalCatalogAdapter implements IDestinationAdapter {
  readonly platform = "custom_d1" as const;

  async exportProduct(product: PubEcomProduct, options: DestinationExportOptions): Promise<ExportResult> {
    try {
      const storeId = options.targetStoreId || product.storeId || `${product.source}:default`;
      
      return {
        success: true,
        platform: this.platform,
        remoteProductId: `${storeId}:${product.externalId}`,
        remoteProductUrl: product.sourceUrl,
        exportedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        platform: this.platform,
        error: err.message || String(err),
        exportedAt: new Date().toISOString(),
      };
    }
  }
}
