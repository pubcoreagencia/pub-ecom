import { IProductScraperProvider, ProviderCapabilities, ProviderCostEstimate, ExtractionOptions, ProviderExtractionResult } from "./IProductScraperProvider.js";
import { UrlDetector } from "../detector/url-detector.js";
import { PubEcomProduct, PubEcomProductSchema } from "../../../actor-core/src/canonical.js";

export interface MercadoLivreOfficialConfig {
  appId?: string;
  clientSecret?: string;
  accessToken?: string;
}

export class MercadoLivreOfficialProvider implements IProductScraperProvider {
  readonly id = "mercadolivre-official-api";
  readonly name = "Mercado Livre Official Open API Provider";
  readonly supportedSource = "mercadolivre";

  private config: MercadoLivreOfficialConfig;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(config: MercadoLivreOfficialConfig = {}) {
    this.config = {
      appId: config.appId || process.env.MERCADOLIVRE_APP_ID,
      clientSecret: config.clientSecret || process.env.MERCADOLIVRE_CLIENT_SECRET,
      accessToken: config.accessToken || process.env.MERCADOLIVRE_ACCESS_TOKEN,
    };
  }

  canHandle(url: string): boolean {
    const detection = UrlDetector.detect(url);
    return detection.source === "mercadolivre";
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVariants: true,
      supportsImages: true,
      supportsStock: true,
      supportsDescription: true,
      supportsStoreDiscovery: true,
      requiresResidentialProxy: false,
    };
  }

  getEstimatedCost(): ProviderCostEstimate {
    return {
      minCostUsd: 0.0000,
      maxCostUsd: 0.0001,
      expectedCostUsd: 0.0000, // Official API is 100% free within daily rate limits (500k req/day)
      currency: "USD",
    };
  }

  hasValidCredentials(): boolean {
    return Boolean(this.config.accessToken || (this.config.appId && this.config.clientSecret));
  }

  private async getAccessToken(): Promise<string | null> {
    if (this.config.accessToken) return this.config.accessToken;
    if (!this.config.appId || !this.config.clientSecret) return null;

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      return this.cachedToken.token;
    }

    try {
      const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.appId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!tokenRes.ok) return null;
      const json = await tokenRes.json();
      if (json.access_token) {
        this.cachedToken = {
          token: json.access_token,
          expiresAt: Date.now() + (json.expires_in || 21600) * 1000,
        };
        return json.access_token;
      }
    } catch {}
    return null;
  }

  async extract(url: string, options?: ExtractionOptions): Promise<ProviderExtractionResult> {
    const startTime = Date.now();
    const detection = UrlDetector.detect(url);
    const itemId = detection.itemId;

    if (!itemId) {
      return {
        success: false,
        diagnostic: {
          strategy: "external-provider",
          success: false,
          blocked: false,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: [],
          fieldsMissing: ["itemId"],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: "Invalid Mercado Livre URL: Item ID (MLB...) could not be extracted",
        },
      };
    }

    // Step 1: Check if credentials are present
    if (!this.hasValidCredentials()) {
      return {
        success: false,
        diagnostic: {
          strategy: "external-provider",
          success: false,
          blocked: true,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: ["itemId"],
          fieldsMissing: ["MERCADOLIVRE_APP_ID", "MERCADOLIVRE_CLIENT_SECRET"],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: "Mercado Livre Official API credentials not configured (Requires App ID + Client Secret from developers.mercadolivre.com.br)",
          error: "Missing server-side MERCADOLIVRE_APP_ID / MERCADOLIVRE_CLIENT_SECRET configuration.",
        },
      };
    }

    try {
      const token = await this.getAccessToken();
      if (!token) {
        return {
          success: false,
          diagnostic: {
            strategy: "external-provider",
            success: false,
            blocked: true,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: ["itemId"],
            fieldsMissing: ["access_token"],
            costUsd: 0,
            durationMs: Date.now() - startTime,
            blockReason: "Failed to generate Mercado Livre Client Credentials access token",
            error: "Mercado Livre OAuth token generation failed.",
          },
        };
      }

      // Step 2: Fetch Item from Official API
      const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 10000),
      });

      if (!itemRes.ok) {
        return {
          success: false,
          diagnostic: {
            strategy: "external-provider",
            success: false,
            blocked: itemRes.status === 401 || itemRes.status === 403,
            recordsFound: 0,
            recordsValid: 0,
            fieldsFound: ["itemId"],
            fieldsMissing: ["itemData"],
            costUsd: 0,
            durationMs: Date.now() - startTime,
            blockReason: `Mercado Livre API Error HTTP ${itemRes.status}`,
            error: `API Item lookup failed: ${itemRes.statusText}`,
          },
        };
      }

      const itemData = await itemRes.json();

      // Step 3: Fetch Description
      let descriptionText: string | null = null;
      try {
        const descRes = await fetch(`https://api.mercadolibre.com/items/${itemId}/description`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (descRes.ok) {
          const descJson = await descRes.json();
          descriptionText = descJson.plain_text || descJson.text || null;
        }
      } catch {}

      // Step 4: Extract attributes and brand
      const brandAttr = itemData.attributes?.find((a: any) => a.id === "BRAND" || a.name === "Marca");
      const brand = brandAttr?.value_name || null;

      const images = (itemData.pictures || []).map((p: any) => p.secure_url || p.url).filter(Boolean);
      const variants = (itemData.variations || []).map((v: any, i: number) => ({
        id: String(v.id || i + 1),
        name: v.attribute_combinations?.map((ac: any) => `${ac.name}: ${ac.value_name}`).join(", ") || `Variação ${i + 1}`,
        price: parseFloat(v.price || itemData.price || 0),
        compareAtPrice: itemData.original_price ? parseFloat(itemData.original_price) : null,
        sku: v.seller_custom_field || null,
        stock: v.available_quantity ?? null,
        image: v.picture_ids?.[0] ? `https://http2.mlstatic.com/D_${v.picture_ids[0]}-O.jpg` : null,
      }));

      const canonical: PubEcomProduct = {
        id: `mercadolivre:mlb:${itemId}`,
        externalId: String(itemId),
        source: "mercadolivre",
        sourceUrl: url,
        storeId: itemData.seller_id ? `mercadolivre:${itemData.seller_id}` : "mercadolivre:default",
        shopId: itemData.seller_id ? String(itemData.seller_id) : null,
        title: itemData.title,
        description: descriptionText,
        price: parseFloat(itemData.price),
        compareAtPrice: itemData.original_price ? parseFloat(itemData.original_price) : null,
        currency: itemData.currency_id || "BRL",
        images: images.length > 0 ? images : [itemData.thumbnail].filter(Boolean),
        thumbnail: itemData.thumbnail || images[0] || null,
        variants,
        sku: itemId,
        stock: itemData.available_quantity ?? 10,
        rating: null,
        soldCount: itemData.sold_quantity ?? null,
        category: itemData.category_id || null,
        brand,
        attributes: {
          condition: itemData.condition,
          warranty: itemData.warranty,
          listingTypeId: itemData.listing_type_id,
        },
        metadata: {
          provider: this.id,
          officialApi: true,
        },
        extractionLevel: "official_api",
        extractedAt: new Date().toISOString(),
      };

      const validation = PubEcomProductSchema.safeParse(canonical);
      return {
        success: validation.success,
        product: validation.success ? validation.data : undefined,
        diagnostic: {
          strategy: "external-provider",
          success: validation.success,
          blocked: false,
          recordsFound: 1,
          recordsValid: validation.success ? 1 : 0,
          fieldsFound: ["title", "price", "images", "variants", "stock", "description"],
          fieldsMissing: [],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: validation.success ? null : validation.error.message,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        diagnostic: {
          strategy: "external-provider",
          success: false,
          blocked: false,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: ["itemId"],
          fieldsMissing: ["all"],
          costUsd: 0,
          durationMs: Date.now() - startTime,
          blockReason: null,
          error: err?.message || String(err),
        },
      };
    }
  }
}
