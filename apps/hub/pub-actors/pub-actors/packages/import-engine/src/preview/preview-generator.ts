import { PubEcomProduct } from "../../../actor-core/src/canonical.js";
import { StrategyExecutionResult } from "../../../actor-core/src/strategies.js";

export interface ImportPreviewPayload {
  product: PubEcomProduct;
  source: string;
  extraction: {
    strategy: string;
    durationMs: number;
    fieldsCount: number;
    imagesCount: number;
    variantsCount: number;
  };
  warnings: string[];
  destinationOptions: {
    recommendedPriceBrl: number;
    suggestedMarginPercent: number;
    defaultTags: string[];
    defaultCategory: string;
  };
  estimatedCostUsd: number;
}

export class PreviewGenerator {
  static generate(product: PubEcomProduct, diagnostic: StrategyExecutionResult, costUsd: number): ImportPreviewPayload {
    const warnings: string[] = [];

    if (!product.description || product.description.length < 20) {
      warnings.push("Descrição curta ou ausente. Recomenda-se enriquecer antes de publicar.");
    }
    if (product.images.length < 2) {
      warnings.push("Apenas 1 imagem encontrada. Recomenda-se adicionar mais imagens.");
    }
    if (product.variants.length === 0) {
      warnings.push("Produto cadastrado como item único sem variações de cor/tamanho.");
    }

    const marginMultiplier = 1.4; // 40% suggested markup
    const recommendedPrice = parseFloat((product.price * marginMultiplier).toFixed(2));

    return {
      product,
      source: product.source,
      extraction: {
        strategy: diagnostic.strategy,
        durationMs: diagnostic.durationMs,
        fieldsCount: diagnostic.fieldsFound.length,
        imagesCount: product.images.length,
        variantsCount: product.variants.length,
      },
      warnings,
      destinationOptions: {
        recommendedPriceBrl: recommendedPrice,
        suggestedMarginPercent: 40,
        defaultTags: [product.source, "import-engine", product.category || "Geral"].filter(Boolean),
        defaultCategory: product.category || "Geral",
      },
      estimatedCostUsd: costUsd,
    };
  }
}
