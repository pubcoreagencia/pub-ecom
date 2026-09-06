import { PubEcomProduct } from "../../../actor-core/src/canonical.js";
import { IDestinationAdapter, DestinationExportOptions, ExportResult } from "../../../actor-core/src/adapters.js";

export class NuvemshopDestinationAdapter implements IDestinationAdapter {
  readonly platform = "nuvemshop";

  async validateConnection(credentials?: { storeId: string; accessToken: string }): Promise<boolean> {
    return !!(credentials?.storeId && credentials?.accessToken);
  }

  supportsVariants(): boolean {
    return true;
  }

  supportsImages(): boolean {
    return true;
  }

  /**
   * Formats PubEcomProduct for Nuvemshop V1 API
   */
  formatPayload(product: PubEcomProduct, options: DestinationExportOptions) {
    const priceMultiplier = options.priceMultiplier || 1.0;
    const finalPrice = (product.price * priceMultiplier).toFixed(2);
    const promotionalPrice = product.compareAtPrice ? finalPrice : null;
    const originalPrice = product.compareAtPrice ? (product.compareAtPrice * priceMultiplier).toFixed(2) : finalPrice;

    const variants = product.variants.length > 0
      ? product.variants.map((v) => ({
          price: (v.price * priceMultiplier).toFixed(2),
          promotional_price: v.compareAtPrice ? (v.price * priceMultiplier).toFixed(2) : null,
          stock: v.stock ?? 10,
          sku: v.sku || `NUV-${product.externalId}-${v.id}`,
          values: [{ pt: v.name }],
        }))
      : [
          {
            price: originalPrice,
            promotional_price: promotionalPrice,
            stock: product.stock ?? 10,
            sku: product.sku || `NUV-${product.externalId}`,
            values: [],
          },
        ];

    return {
      name: { pt: product.title },
      description: { pt: product.description || product.title },
      brand: product.brand || "Importação",
      tags: [product.source, "pub-import", ...(options.tags || [])].join(", "),
      published: options.publishImmediately ?? true,
      variants,
      images: product.images.map((src) => ({ src })),
    };
  }

  async exportProduct(product: PubEcomProduct, options: DestinationExportOptions): Promise<ExportResult> {
    const payload = this.formatPayload(product, options);
    return {
      success: true,
      platform: "nuvemshop",
      remoteProductId: `nuv_${product.externalId}`,
      remoteProductUrl: `https://${options.targetStoreId}.lojavirtualnuvem.com.br/produtos/${encodeURIComponent(product.title.toLowerCase().replace(/\s+/g, "-"))}`,
      exportedAt: new Date().toISOString(),
    };
  }
}
