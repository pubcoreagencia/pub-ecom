export interface AnalyzeUrlResponse {
  success: boolean;
  provider: string;
  strategyUsed: string;
  durationMs: number;
  product: {
    id: string;
    externalId: string;
    source: string;
    sourceUrl: string;
    title: string;
    description: string | null;
    price: number;
    currency: string;
    images: string[];
    thumbnail: string | null;
    variants: any[];
    sku: string | null;
    stock: number | null;
    category: string | null;
    brand: string | null;
    attributes: Record<string, any>;
    metadata: Record<string, any>;
  } | null;
  preview: {
    title: string;
    mainImage: string;
    costPrice: number;
    suggestedSalePrice: number;
    projectedProfit: number;
    markupPercent: number;
    marketplace: string;
    variantsCount: number;
    imagesCount: number;
  } | null;
  provenance: Record<string, { value: any; source: string }>;
  warnings: string[];
  error?: string;
}

export interface CommitImportResponse {
  success: boolean;
  importId?: string;
  productId?: string;
  status: "IMPORTED" | "ALREADY_IMPORTED" | "INVALID" | "REJECTED_FLAG_DISABLED" | "UNAUTHORIZED" | "FAILED";
  error?: string;
}

export class UrlImportClient {
  /**
   * Step 1: Analyze URL
   */
  static async analyzeUrl(url: string, markupPercent = 40): Promise<AnalyzeUrlResponse> {
    try {
      const res = await fetch("/api/catalog/import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, markupPercent }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Erro ${res.status} ao analisar URL.`);
      }

      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        provider: "unknown",
        strategyUsed: "failed",
        durationMs: 0,
        product: null,
        preview: null,
        provenance: {},
        warnings: [],
        error: err.message || String(err),
      };
    }
  }

  /**
   * Step 2: Commit Import
   */
  static async commitImport(product: any, tenantId: string): Promise<CommitImportResponse> {
    try {
      const res = await fetch("/api/catalog/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, tenantId }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Erro ${res.status} ao persistir produto.`);
      }

      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        status: "FAILED",
        error: err.message || String(err),
      };
    }
  }
}
