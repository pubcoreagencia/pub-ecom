export interface AnalyzeUrlResponse {
  success: boolean;
  assistedRequired?: boolean;
  reason?: string;
  message?: string;
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

import { supabase } from "@/integrations/supabase/client";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn("[UrlImportClient] Falha ao obter sessão do Supabase:", err);
  }
  return headers;
}

export class UrlImportClient {
  /**
   * Step 1: Analyze URL with Hybrid L3 fallback
   */
  static async analyzeUrl(
    url: string,
    markupPercent = 40,
    onStateChange?: (state: "ANALYZING" | "ASSISTED_REQUIRED") => void
  ): Promise<AnalyzeUrlResponse> {
    try {
      const headers = await getAuthHeaders();
      console.log("[UrlImportClient] Disparando POST /api/catalog/import/analyze...");
      const res = await fetch("/api/catalog/import/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ url, markupPercent }),
      });

      console.log(`[UrlImportClient] Resposta recebida: HTTP ${res.status}`);

      const result: AnalyzeUrlResponse = await res.json().catch(() => ({
        success: false,
        provider: "unknown",
        strategyUsed: "failed",
        durationMs: 0,
        product: null,
        preview: null,
        provenance: {},
        warnings: [],
        error: `Erro HTTP ${res.status}`,
      }));

      // If remote Browser Run encountered an interstitial / challenge -> trigger assisted extraction
      if (!result.success && result.assistedRequired) {
        console.log("[UrlImportClient] Bloqueio remoto detectado. Iniciando fallback assistido no navegador...");
        if (onStateChange) onStateChange("ASSISTED_REQUIRED");

        const assistedData = await UrlImportClient.performAssistedExtraction(url);
        if (assistedData) {
          console.log("[UrlImportClient] Enviando payload assistido normalizado para validação do Catalog Worker...");
          const assistedRes = await fetch("/api/catalog/import/analyze", {
            method: "POST",
            headers,
            body: JSON.stringify({
              url,
              markupPercent,
              clientCollectedData: assistedData,
            }),
          });

          if (assistedRes.ok) {
            return await assistedRes.json();
          }
        }
      }

      if (!res.ok && !result.success) {
        throw new Error(result.error || `Erro ${res.status} ao analisar URL.`);
      }

      return result;
    } catch (err: any) {
      console.error("[UrlImportClient] Erro na análise:", err.message);
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
   * Helper to perform client-side assisted collection
   */
  static async performAssistedExtraction(targetUrl: string): Promise<any | null> {
    try {
      const mlIdMatch = targetUrl.match(/(MLB-?\d+)/i);
      const cleanUrl = (targetUrl.split("#")[0] || "").split("?")[0] || "";
      const parts = cleanUrl.split("/").filter(Boolean);
      const externalId = (mlIdMatch && mlIdMatch[1]) ? mlIdMatch[1].replace("-", "") : (parts[parts.length - 1] || "ITEM_1");

      if (typeof window !== "undefined" && typeof document !== "undefined") {
        const doc = document;
        const domTitle = doc.querySelector("h1.ui-pdp-title, h1#title, h1#productTitle, h1");
        const frac = doc.querySelector(".andes-money-amount__fraction");
        const cents = doc.querySelector(".andes-money-amount__cents");

        let price: number | null = null;
        if (frac && frac.textContent) {
          const raw = frac.textContent.trim().replace(/\./g, "");
          const c = cents && cents.textContent ? cents.textContent.trim() : "00";
          price = parseFloat(`${raw}.${c}`);
        }

        const images: string[] = [];
        const imgEls = doc.querySelectorAll(".ui-pdp-gallery__figure img, #imgTagWrapperId img, img[data-zoom]");
        imgEls.forEach((el) => {
          const src = el.getAttribute("data-zoom") || el.getAttribute("data-old-hires") || (el as HTMLImageElement).src;
          if (src && src.startsWith("http") && !src.includes("placeholder") && !images.includes(src)) {
            images.push(src);
          }
        });

        const title = domTitle && domTitle.textContent ? domTitle.textContent.trim() : null;

        if (title && price !== null && images.length > 0) {
          return {
            sourceUrl: targetUrl,
            marketplace: "mercadolivre",
            externalId,
            title,
            price,
            currency: "BRL",
            images,
            brand: null,
            description: null,
            variants: [],
            attributes: {},
            provenance: {
              title: { value: title, source: "client_assisted_dom" },
              price: { value: price, source: "client_assisted_dom" },
              images: { value: images, source: "client_assisted_dom" },
            },
          };
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Step 2: Commit Import
   */
  static async commitImport(product: any, tenantId: string): Promise<CommitImportResponse> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/catalog/import/commit", {
        method: "POST",
        headers,
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

