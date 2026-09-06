import { PubEcomProduct } from "../../actor-core/src/canonical.js";

export interface BrowserImportPreview {
  product: PubEcomProduct;
  marketplace: string;
  originalPriceBrl: number;
  markupPercent: number;
  suggestedSalePriceBrl: number;
  projectedProfitBrl: number;
  mainImage: string;
  sourceUrl: string;
  tags: string[];
  warnings: string[];
}

export class PreviewBuilder {
  static build(product: PubEcomProduct, markupPercent = 40): BrowserImportPreview {
    const originalPrice = product.price;
    const multiplier = 1 + markupPercent / 100;
    const suggestedPrice = parseFloat((originalPrice * multiplier).toFixed(2));
    const profit = parseFloat((suggestedPrice - originalPrice).toFixed(2));

    const warnings: string[] = [];
    if (!product.description || product.description.length < 10) {
      warnings.push("Descrição curta ou ausente.");
    }
    if (!product.brand) {
      warnings.push("Marca não identificada no catálogo.");
    }

    return {
      product,
      marketplace: product.source,
      originalPriceBrl: originalPrice,
      markupPercent,
      suggestedSalePriceBrl: suggestedPrice,
      projectedProfitBrl: profit,
      mainImage: product.images[0] || product.thumbnail || "",
      sourceUrl: product.sourceUrl,
      tags: [product.source, "pub-browser-import", product.category || "Geral"].filter(Boolean),
      warnings,
    };
  }
}
