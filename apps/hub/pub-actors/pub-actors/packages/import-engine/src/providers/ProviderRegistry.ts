import { IProductScraperProvider } from "./IProductScraperProvider.js";
import { MercadoLivreProvider } from "./MercadoLivreProvider.js";
import { ShopeeProvider } from "./ShopeeProvider.js";
import { TikTokShopProvider } from "./TikTokShopProvider.js";
import { AmazonProvider } from "./AmazonProvider.js";
import { GenericProvider } from "./GenericProvider.js";

export class ProviderRegistry {
  private providers: IProductScraperProvider[] = [];

  constructor() {
    // Register default providers in priority order
    this.register(new TikTokShopProvider());
    this.register(new MercadoLivreProvider());
    this.register(new ShopeeProvider());
    this.register(new AmazonProvider());
    this.register(new GenericProvider());
  }

  register(provider: IProductScraperProvider): void {
    this.providers.push(provider);
  }

  resolve(url: string): IProductScraperProvider {
    for (const provider of this.providers) {
      if (provider.canHandle(url)) {
        return provider;
      }
    }
    // Fallback to generic
    return new GenericProvider();
  }

  listProviders(): Array<{ id: string; name: string; source: string; capabilities: any; cost: any }> {
    return this.providers.map((p) => ({
      id: p.id,
      name: p.name,
      source: p.supportedSource,
      capabilities: p.getCapabilities(),
      cost: p.getEstimatedCost(),
    }));
  }
}
