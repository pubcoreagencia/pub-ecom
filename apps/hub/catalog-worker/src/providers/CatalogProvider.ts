/**
 * Catalog Provider Contract
 *
 * Defines the generic interface for marketplace/e-commerce catalog providers.
 * Decouples marketplace-specific crawling, parsing, and anti-bot logic
 * from the centralized Sync Engine and Cloudflare D1 persistence.
 */

export type ExtractionStatus =
  | "success"
  | "empty_catalog"
  | "anti_bot"
  | "network_error"
  | "parse_error"
  | "runtime_error"
  | "source_unavailable";

export interface StrategyDiagnostic {
  strategy: string;
  url: string;
  httpStatus: number;
  durationMs: number;
  productsFound: number;
  challengeDetected: boolean;
  reason: string;
}

export interface NormalizedProduct {
  id: string; // `${storeId}:${externalId}`
  external_id: string;
  store_id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  images: string[];
  url: string;
  sku: string | null;
  category: string | null;
  source: string;
  metadata?: Record<string, any>;
}

export interface StoreTarget {
  id: string;
  name: string;
  username?: string | null;
  source: string;
  shopId: string;
  metadata?: Record<string, any> | null;
}

export interface ProviderExtractionResult {
  success: boolean;
  status: ExtractionStatus;
  provider: string;
  shopId: string | null;
  username: string;
  products: NormalizedProduct[];
  strategyUsed: string;
  attempts: number;
  challengeDetected: boolean;
  reason: ExtractionStatus;
  error?: string;
  diagnostics: StrategyDiagnostic[];
  metadata: Record<string, any>;
}

export interface CatalogProvider {
  readonly name: string;
  readonly source: string;

  /**
   * Checks if this provider handles the given store source.
   */
  canHandle(source: string): boolean;

  /**
   * Extracts and normalizes products from the store target.
   */
  extract(target: StoreTarget, limit: number, env: any): Promise<ProviderExtractionResult>;
}
