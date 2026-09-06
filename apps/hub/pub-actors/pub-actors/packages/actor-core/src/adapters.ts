import { PubEcomProduct } from "./canonical.js";

export type DestinationPlatform = "shopify" | "nuvemshop" | "woocommerce" | "custom_d1";

export interface DestinationExportOptions {
  platform: DestinationPlatform;
  targetStoreId: string;
  publishImmediately?: boolean;
  priceMultiplier?: number;
  tags?: string[];
}

export interface ExportResult {
  success: boolean;
  platform: DestinationPlatform;
  remoteProductId?: string;
  remoteProductUrl?: string;
  error?: string;
  exportedAt: string;
}

export interface IDestinationAdapter {
  readonly platform: DestinationPlatform;
  
  exportProduct(product: PubEcomProduct, options: DestinationExportOptions): Promise<ExportResult>;
  
  exportBatch?(products: PubEcomProduct[], options: DestinationExportOptions): Promise<ExportResult[]>;
}
