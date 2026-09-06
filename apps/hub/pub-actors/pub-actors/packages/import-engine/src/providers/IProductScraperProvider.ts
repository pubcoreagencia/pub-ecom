import { PubEcomProduct } from "../../../actor-core/src/canonical.js";
import { StrategyExecutionResult } from "../../../actor-core/src/strategies.js";

export interface ProviderCapabilities {
  supportsVariants: boolean;
  supportsImages: boolean;
  supportsStock: boolean;
  supportsDescription: boolean;
  supportsStoreDiscovery: boolean;
  requiresResidentialProxy: boolean;
}

export interface ProviderCostEstimate {
  minCostUsd: number;
  maxCostUsd: number;
  expectedCostUsd: number;
  currency: string;
}

export interface ExtractionOptions {
  preferredCurrency?: string;
  maxVariants?: number;
  timeoutMs?: number;
  allowFallback?: boolean;
}

export interface ProviderExtractionResult {
  success: boolean;
  product?: PubEcomProduct;
  diagnostic: StrategyExecutionResult;
  rawPayload?: any;
}

export interface IProductScraperProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedSource: string;

  canHandle(url: string): boolean;
  getCapabilities(): ProviderCapabilities;
  getEstimatedCost(): ProviderCostEstimate;
  extract(url: string, options?: ExtractionOptions): Promise<ProviderExtractionResult>;
}
