import { SsrfValidator } from "./security/ssrfValidator.js";
import { BrowserWorker } from "./workers/BrowserWorker.js";
import { PubEcomProduct, PubEcomProductSchema } from "../../actor-core/src/canonical.js";
import { detectMarketplace } from "../../browser-collector/src/marketplace-detector.js";

export type CascadeStrategyUsed = "http_level_1" | "official_api_level_2" | "browser_worker_level_3" | "failed";

export interface UrlImportAnalyzeResult {
  success: boolean;
  provider: string;
  strategyUsed: CascadeStrategyUsed;
  durationMs: number;
  product: PubEcomProduct | null;
  provenance: Record<string, { value: any; source: string }>;
  warnings: string[];
  error?: string;
}

export class UrlImportRouter {
  /**
   * Analyzes an untrusted product URL through the 3-level cascade strategy
   */
  static async analyzeUrl(rawUrl: string): Promise<UrlImportAnalyzeResult> {
    const startTime = Date.now();

    // 1. SSRF & Security Validation
    const ssrfCheck = SsrfValidator.validate(rawUrl);
    if (!ssrfCheck.isValid || !ssrfCheck.sanitizedUrl) {
      return {
        success: false,
        provider: "unknown",
        strategyUsed: "failed",
        durationMs: Date.now() - startTime,
        product: null,
        provenance: {},
        warnings: [],
        error: ssrfCheck.error || "URL rejeitada por segurança (SSRF).",
      };
    }

    const url = ssrfCheck.sanitizedUrl;
    const detection = detectMarketplace(url);
    const provider = detection.marketplace;

    // ----------------------------------------------------
    // LEVEL 1: HTTP GET (JSON-LD / OpenGraph / Meta)
    // ----------------------------------------------------
    try {
      const httpRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (httpRes.ok) {
        const html = await httpRes.text();

        // Extract JSON-LD
        let jsonldTitle: string | null = null;
        let jsonldPrice: number | null = null;
        let jsonldImages: string[] = [];
        let jsonldDesc: string | null = null;
        let jsonldBrand: string | null = null;

        const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
        for (const m of jsonLdMatches) {
          try {
            const parsed = JSON.parse(m[1]);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              if (item["@type"] === "Product" || item.name) {
                if (item.name && !jsonldTitle) jsonldTitle = String(item.name).trim();
                if (item.description && !jsonldDesc) jsonldDesc = String(item.description).trim();
                if (item.brand?.name && !jsonldBrand) jsonldBrand = String(item.brand.name);
                if (item.offers) {
                  const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                  if (offer?.price && !jsonldPrice) jsonldPrice = parseFloat(offer.price);
                }
                if (item.image) {
                  const imgs = Array.isArray(item.image) ? item.image : [item.image];
                  imgs.forEach((im: any) => {
                    const src = typeof im === "string" ? im : im.url;
                    if (src && src.startsWith("http") && !jsonldImages.includes(src)) jsonldImages.push(src);
                  });
                }
              }
            }
          } catch {}
        }

        // OpenGraph fallback
        const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
        const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
        const ogPriceMatch = html.match(/<meta property="product:price:amount" content="([^"]+)"/i);

        const title = jsonldTitle || (ogTitleMatch ? ogTitleMatch[1].trim() : null);
        const price = jsonldPrice || (ogPriceMatch ? parseFloat(ogPriceMatch[1]) : null);
        const images = jsonldImages.length > 0 ? jsonldImages : ogImageMatch ? [ogImageMatch[1]] : [];

        // If Level 1 succeeded completely
        if (title && price && price > 0 && images.length > 0) {
          const externalId = detection.productId || "ITEM_1";
          const canonical: PubEcomProduct = {
            id: `${provider}:default:${externalId}`,
            externalId,
            source: provider as any,
            sourceUrl: url,
            storeId: `${provider}:default`,
            shopId: detection.shopId,
            title,
            description: jsonldDesc,
            price,
            compareAtPrice: null,
            currency: "BRL",
            images,
            thumbnail: images[0],
            variants: [],
            sku: `PUB-${externalId}`,
            stock: 50,
            brand: jsonldBrand,
            attributes: { cascadeLevel: "http_level_1" },
            metadata: { extractionLevel: "url_engine_http" },
            extractionLevel: "http_level_1",
            extractedAt: new Date().toISOString(),
          };

          const validation = PubEcomProductSchema.safeParse(canonical);
          if (validation.success) {
            return {
              success: true,
              provider,
              strategyUsed: "http_level_1",
              durationMs: Date.now() - startTime,
              product: validation.data,
              provenance: {
                title: { value: title, source: jsonldTitle ? "jsonld" : "opengraph" },
                price: { value: price, source: jsonldPrice ? "jsonld" : "opengraph" },
                images: { value: images, source: jsonldImages.length > 0 ? "jsonld" : "opengraph" },
              },
              warnings: [],
            };
          }
        }
      }
    } catch {}

    // ----------------------------------------------------
    // LEVEL 3: BROWSER WORKER (Headless Chromium Remote Execution)
    // ----------------------------------------------------
    const workerResult = await BrowserWorker.renderAndCollect(url, 20000);

    if (workerResult.success && workerResult.collectorOutput) {
      const audited = workerResult.collectorOutput.auditedProduct;
      const externalId = detection.productId || "ITEM_1";

      const canonical: PubEcomProduct = {
        id: `${provider}:default:${externalId}`,
        externalId,
        source: provider as any,
        sourceUrl: url,
        storeId: `${provider}:default`,
        shopId: detection.shopId,
        title: audited.title.value || "",
        description: audited.description?.value || null,
        price: audited.price.value || 0,
        compareAtPrice: null,
        currency: "BRL",
        images: audited.images.value,
        thumbnail: audited.images.value[0],
        variants: [],
        sku: `PUB-${externalId}`,
        stock: 50,
        brand: audited.brand?.value || null,
        attributes: { cascadeLevel: "browser_worker_level_3" },
        metadata: { extractionLevel: "url_engine_browser" },
        extractionLevel: "browser_worker",
        extractedAt: new Date().toISOString(),
      };

      const validation = PubEcomProductSchema.safeParse(canonical);
      if (validation.success) {
        return {
          success: true,
          provider,
          strategyUsed: "browser_worker_level_3",
          durationMs: Date.now() - startTime,
          product: validation.data,
          provenance: {
            title: { value: audited.title.value, source: audited.title.source },
            price: { value: audited.price.value, source: audited.price.source },
            images: { value: audited.images.value, source: audited.images.source },
          },
          warnings: [],
        };
      }
    }

    return {
      success: false,
      provider,
      strategyUsed: "failed",
      durationMs: Date.now() - startTime,
      product: null,
      provenance: {},
      warnings: ["Não foi possível extrair dados suficientes desta URL."],
      error: workerResult.error || "Falha na extração em cascata (HTTP e Browser Worker).",
    };
  }
}
