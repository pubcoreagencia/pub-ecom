/**
 * Catalog Provider Registry
 *
 * Central registry that resolves CatalogProvider instances by store source.
 */

import { CatalogProvider } from "./CatalogProvider";
import { ShopeeProvider } from "./ShopeeProvider";
import { MercadoLivreProvider } from "./MercadoLivreProvider";

export * from "./CatalogProvider";
export * from "./ShopeeProvider";
export * from "./MercadoLivreProvider";

const providerRegistry = new Map<string, CatalogProvider>();
const shopeeProvider = new ShopeeProvider();
const mlProvider = new MercadoLivreProvider();
providerRegistry.set("shopee", shopeeProvider);
providerRegistry.set("mercadolivre", mlProvider);
providerRegistry.set("mercado_livre", mlProvider);
providerRegistry.set("ml", mlProvider);

export function getCatalogProvider(source: string): CatalogProvider {
  if (!source) {
    throw new Error("Fonte da loja (source) não informada");
  }
  const provider = providerRegistry.get(source.toLowerCase());
  if (!provider) {
    throw new Error(`Provider não suportado para a fonte: '${source}'`);
  }
  return provider;
}

export function registerCatalogProvider(provider: CatalogProvider): void {
  providerRegistry.set(provider.source.toLowerCase(), provider);
}

export function listSupportedSources(): string[] {
  return Array.from(providerRegistry.keys());
}
