import { PubEcomProduct } from "../../actor-core/src/canonical.js";

export interface DestinationPayloads {
  shopify: {
    valid: boolean;
    payload: any;
  };
  nuvemshop: {
    valid: boolean;
    payload: any;
  };
}

export class DestinationPayloadBuilder {
  static build(product: PubEcomProduct, suggestedSalePrice: number): DestinationPayloads {
    // 1. Shopify Payload
    const shopifyPayload = {
      product: {
        title: product.title,
        body_html: `<p>${product.description || product.title}</p>`,
        vendor: `PUB ${product.source.toUpperCase()}`,
        product_type: product.category || "Geral",
        tags: [product.source, "pub-browser-import"].join(", "),
        published: true,
        variants: [
          {
            price: suggestedSalePrice.toFixed(2),
            compare_at_price: product.compareAtPrice ? (product.compareAtPrice * 1.4).toFixed(2) : null,
            sku: product.sku || `PUB-${product.externalId}`,
            inventory_management: "shopify",
            inventory_quantity: product.stock ?? 10,
          },
        ],
        images: product.images.map((src, i) => ({ src, position: i + 1 })),
      },
    };

    // 2. Nuvemshop Payload
    const nuvemshopPayload = {
      name: { pt: product.title },
      description: { pt: product.description || product.title },
      brand: product.brand || "Importação",
      tags: [product.source, "pub-browser-import"].join(", "),
      published: true,
      variants: [
        {
          price: suggestedSalePrice.toFixed(2),
          promotional_price: product.compareAtPrice ? (product.price * 1.4).toFixed(2) : null,
          stock: product.stock ?? 10,
          sku: product.sku || `NUV-${product.externalId}`,
          values: [],
        },
      ],
      images: product.images.map((src) => ({ src })),
    };

    return {
      shopify: {
        valid: Boolean(shopifyPayload.product.title && shopifyPayload.product.images.length > 0),
        payload: shopifyPayload,
      },
      nuvemshop: {
        valid: Boolean(nuvemshopPayload.name.pt && nuvemshopPayload.images.length > 0),
        payload: nuvemshopPayload,
      },
    };
  }
}
