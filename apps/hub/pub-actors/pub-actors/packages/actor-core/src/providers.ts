import { PubEcomProduct } from "./canonical.js";
import { StrategyExecutionResult } from "./strategies.js";

export type SupportedMarketplace = "shopee" | "mercadolivre" | "amazon" | "aliexpress" | "tiktokshop" | "generic";

export interface ProductImportQuery {
  url: string;
  marketplace?: SupportedMarketplace;
  preferredCurrency?: string;
  maxVariants?: number;
}

export interface StoreDiscoveryQuery {
  url: string;
  marketplace?: SupportedMarketplace;
  maxProducts?: number;
}

export interface DiscoveredProductCandidate {
  shopId: string;
  itemId: string;
  url: string;
  title?: string | null;
  price?: number | null;
  image?: string | null;
}

export interface IProductScraperProvider {
  readonly marketplace: SupportedMarketplace;
  readonly name: string;
  
  canHandle(url: string): boolean;
  
  importProduct(query: ProductImportQuery): Promise<{
    success: boolean;
    product?: PubEcomProduct;
    diagnostic: StrategyExecutionResult;
  }>;

  discoverStore?(query: StoreDiscoveryQuery): Promise<{
    success: boolean;
    shopId?: string | null;
    username?: string | null;
    candidates: DiscoveredProductCandidate[];
    diagnostic: StrategyExecutionResult;
  }>;
}
