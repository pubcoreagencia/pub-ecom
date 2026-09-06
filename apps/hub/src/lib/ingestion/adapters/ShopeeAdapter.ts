import { CatalogSourceAdapter, RawProduct } from "../types";
import { ShopeeExecutionProvider } from "../execution/ShopeeExecutionProvider";
import { MockExecutionProvider } from "../execution/MockExecutionProvider";
import { ExecutionProvider } from "../execution/ExecutionProvider";

import { validateTargetUrl } from "../security/urlValidator";

export class ShopeeAdapter implements CatalogSourceAdapter {
  private executionProvider: ExecutionProvider<any>;
  private maxProductsPerImport = 50;

  constructor() {
    // In production, we use ShopeeExecutionProvider.
    // We could use an environment variable to toggle this.
    const isMock = process.env["VITE_INGESTION_MOCK"] === "true";
    this.executionProvider = isMock ? new MockExecutionProvider() : new ShopeeExecutionProvider();
  }

  canHandle(url: string): boolean {
    // Strict hostname validation — substring matching (url.includes) is
    // spoofable via URLs like https://evil.com/?ref=shopee.com.br
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return /^([a-z0-9-]+\.)*shopee\.com\.br$/.test(hostname);
    } catch {
      return false;
    }
  }

  private extractShopId(url: string): string | null {
    const shopIdMatch = url.match(/\/shop\/(\d+)/);
    if (shopIdMatch) return shopIdMatch[1] || null;

    const productMatch = url.match(/\/product\/(\d+)/);
    if (productMatch) return productMatch[1] || null;

    return null;
  }

  async discover(url: string): Promise<RawProduct[]> {
    validateTargetUrl(url);
    console.log(`[ShopeeAdapter] Starting discovery for: ${url}`);

    const shopId = this.extractShopId(url);

    try {
      const result = await this.executionProvider.execute({
        url,
        shopId,
        limit: this.maxProductsPerImport,
      });

      if (result.errors.length > 0) {
        console.warn(`[ShopeeAdapter] Worker reported errors:`, result.errors);
      }

      return result.data.map((item) => ({
        externalId: item.itemid.toString(),
        url: `https://shopee.com.br/product/${item.shopid}/${item.itemid}`,
        title: item.name,
        description: null,
        price: item.price / 100000,
        originalPrice: item.price_before_discount ? item.price_before_discount / 100000 : null,
        stock: item.stock,
        images: item.images.map((img: string) => `https://cf.shopee.com.br/file/${img}`),
        category: null,
        metadata: {
          raw_itemid: item.itemid,
          raw_shopid: item.shopid,
          historical_sold: item.historical_sold,
          worker_metadata: result.metadata,
        },
      }));
    } catch (error: any) {
      console.error(`[ShopeeAdapter] Critical error during discovery:`, error);
      throw new Error(`Falha ao acessar a Shopee: ${error.message}`);
    }
  }
}
