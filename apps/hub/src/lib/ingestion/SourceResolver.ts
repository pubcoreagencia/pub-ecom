import { CatalogSourceAdapter } from "./types";
import { ShopeeAdapter } from "./adapters/ShopeeAdapter";
import { MockAdapter } from "./adapters/MockAdapter";
import { isAllowedTargetUrl } from "./security/urlValidator";

export class SourceResolver {
  private adapters: CatalogSourceAdapter[] = [new ShopeeAdapter(), new MockAdapter()];

  resolve(url: string): CatalogSourceAdapter | null {
    // Se for URL de teste segura em ambiente sandbox/mock
    if (url.includes("test") && !url.startsWith("http")) {
      return this.adapters.find((a) => a instanceof MockAdapter) || null;
    }

    // SSRF Check: URL must be strictly whitelisted
    if (!isAllowedTargetUrl(url)) {
      return null;
    }

    return this.adapters.find((adapter) => adapter.canHandle(url)) || null;
  }
}
