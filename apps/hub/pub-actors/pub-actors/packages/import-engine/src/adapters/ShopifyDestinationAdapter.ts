import { PubEcomProduct } from "../../../actor-core/src/canonical.js";
import { IDestinationAdapter, DestinationExportOptions, ExportResult } from "../../../actor-core/src/adapters.js";

export class ShopifyDestinationAdapter implements IDestinationAdapter {
  readonly platform = "shopify";

  async validateConnection(credentials?: { shopDomain: string; accessToken: string }): Promise<boolean> {
    return !!(credentials?.shopDomain && credentials?.accessToken);
  }

  supportsVariants(): boolean {
    return true;
  }

  supportsImages(): boolean {
    return true;
  }

  /**
   * Converts PubEcomProduct to Shopify Product creation payload
   */
  formatPayload(product: PubEcomProduct, options: DestinationExportOptions) {
    const priceMultiplier = options.priceMultiplier || 1.0;
    const finalPrice = (product.price * priceMultiplier).toFixed(2);
    const compareAt = product.compareAtPrice ? (product.compareAtPrice * priceMultiplier).toFixed(2) : null;

    const variants = product.variants.length > 0
      ? product.variants.map((v) => ({
          option1: v.name,
          price: (v.price * priceMultiplier).toFixed(2),
          compare_at_price: v.compareAtPrice ? (v.compareAtPrice * priceMultiplier).toFixed(2) : compareAt,
          sku: v.sku || `PUB-${product.externalId}-${v.id}`,
          inventory_management: "shopify",
          inventory_quantity: v.stock ?? 10,
        }))
      : [
          {
            option1: "Default Title",
            price: finalPrice,
            compare_at_price: compareAt,
            sku: product.sku || `PUB-${product.externalId}`,
            inventory_management: "shopify",
            inventory_quantity: product.stock ?? 10,
          },
        ];

    return {
      product: {
        title: product.title,
        body_html: product.description ? `<p>${product.description.replace(/\n/g, "<br/>")}</p>` : `<p>${product.title}</p>`,
        vendor: product.brand || `PUB ${product.source.toUpperCase()}`,
        product_type: product.category || "General",
        tags: [product.source, "pub-import", ...(options.tags || [])].join(", "),
        published: options.publishImmediately ?? true,
        variants,
        images: product.images.map((src, index) => ({
          src,
          position: index + 1,
          alt: `${product.title} - Imagem ${index + 1}`,
        })),
      },
    };
  }

  async exportProduct(product: PubEcomProduct, options: DestinationExportOptions): Promise<ExportResult> {
    const payload = this.formatPayload(product, options);
    // Simulates clean export generation
    return {
      success: true,
      platform: "shopify",
      remoteProductId: `gid://shopify/Product/mock_${product.externalId}`,
      remoteProductUrl: `https://${options.targetStoreId}.myshopify.com/products/${encodeURIComponent(product.title.toLowerCase().replace(/\s+/g, "-"))}`,
      exportedAt: new Date().toISOString(),
    };
  }
}
