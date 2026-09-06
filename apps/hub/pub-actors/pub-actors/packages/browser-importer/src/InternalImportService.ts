import { PubEcomProduct, PubEcomProductSchema } from "../../actor-core/src/canonical.js";

export interface ImportRequestPayload {
  product: PubEcomProduct;
  importSource: "browser" | "api" | "worker";
  tenantId: string;
  userId?: string;
}

export interface ImportResponsePayload {
  success: boolean;
  importId?: string;
  productId?: string;
  status: "IMPORTED" | "ALREADY_IMPORTED" | "INVALID" | "REJECTED_FLAG_DISABLED" | "UNAUTHORIZED";
  error?: string;
  product?: PubEcomProduct;
}

export interface InternalStoreRecord {
  id: string;
  external_id: string;
  tenant_id: string;
  store_id: string;
  source: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  images: string[];
  url: string;
  sku: string;
  category: string | null;
  brand: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class InternalImportService {
  private static mockDatabase = new Map<string, InternalStoreRecord>();

  /**
   * Clears database (for test isolation)
   */
  static clearStorage(): void {
    this.mockDatabase.clear();
  }

  /**
   * Core Import Handler
   */
  static async importProduct(
    payload: ImportRequestPayload,
    options: {
      featureFlagEnabled?: boolean;
      authToken?: string;
      expectedToken?: string;
      customStorage?: Map<string, InternalStoreRecord>;
    } = {},
  ): Promise<ImportResponsePayload> {
    const isFeatureEnabled = options.featureFlagEnabled ?? (process.env.BROWSER_IMPORT_ENABLED === "true");

    // 1. Feature Flag Check
    if (!isFeatureEnabled) {
      return {
        success: false,
        status: "REJECTED_FLAG_DISABLED",
        error: "Feature flag BROWSER_IMPORT_ENABLED está desabilitada.",
      };
    }

    // 2. Authentication Check
    if (options.expectedToken && options.authToken !== options.expectedToken) {
      return {
        success: false,
        status: "UNAUTHORIZED",
        error: "Não autorizado: Token inválido ou ausente.",
      };
    }

    // 3. Tenant ID Check
    if (!payload.tenantId || payload.tenantId.trim().length === 0) {
      return {
        success: false,
        status: "INVALID",
        error: "Identificador de tenant (tenantId) é obrigatório.",
      };
    }

    // 4. Schema & Zero-Mock Validation
    const validation = PubEcomProductSchema.safeParse(payload.product);
    if (!validation.success) {
      return {
        success: false,
        status: "INVALID",
        error: `Payload inválido: ${validation.error.message}`,
      };
    }

    const rawStr = JSON.stringify(payload.product).toLowerCase();
    if (
      rawStr.includes("_mock") ||
      rawStr.includes("placeholder") ||
      rawStr.includes("synthetic") ||
      rawStr.includes("fake_")
    ) {
      return {
        success: false,
        status: "INVALID",
        error: "Dado sintético ou mock detectado. Importação rejeitada.",
      };
    }

    const prod = validation.data;
    const storage = options.customStorage || this.mockDatabase;

    // 5. Idempotent Deduplication Check (tenantId + source + externalId)
    const compositeKey = `${payload.tenantId}:${prod.source}:${prod.externalId}`;
    const existing = storage.get(compositeKey);

    if (existing) {
      return {
        success: true,
        importId: `imp_dup_${Date.now()}`,
        productId: existing.id,
        status: "ALREADY_IMPORTED",
        product: prod,
      };
    }

    // 6. Persistence in Internal Catalog
    const productId = `${prod.source}:${payload.tenantId}:${prod.externalId}`;
    const importId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const record: InternalStoreRecord = {
      id: productId,
      external_id: prod.externalId,
      tenant_id: payload.tenantId,
      store_id: prod.storeId || `${prod.source}:default`,
      source: prod.source,
      title: prod.title,
      description: prod.description || null,
      price: prod.price,
      currency: prod.currency,
      images: prod.images,
      url: prod.sourceUrl,
      sku: prod.sku || `PUB-${prod.externalId}`,
      category: prod.category || null,
      brand: prod.brand || null,
      metadata: {
        ...prod.metadata,
        provenance: prod.attributes?.auditedSources || {},
        importSource: payload.importSource,
        userId: payload.userId || null,
        importedAt: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    storage.set(compositeKey, record);

    return {
      success: true,
      importId,
      productId,
      status: "IMPORTED",
      product: prod,
    };
  }

  /**
   * Query product by ID with strict tenant isolation
   */
  static getProduct(tenantId: string, source: string, externalId: string, storage = this.mockDatabase): InternalStoreRecord | null {
    const key = `${tenantId}:${source}:${externalId}`;
    return storage.get(key) || null;
  }
}
