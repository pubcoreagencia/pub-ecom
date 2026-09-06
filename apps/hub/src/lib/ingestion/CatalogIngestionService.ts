import { ImportPreview, NormalizedProduct, RawProduct, ImportStatus } from "./types";
import { SourceResolver } from "./SourceResolver";
import { PricingService } from "../services/PricingService";
import { masterProductRepository } from "../repositories/masterProductRepository";

export class CatalogIngestionService {
  private resolver = new SourceResolver();

  async analyzeSource(url: string): Promise<ImportPreview> {
    const adapter = this.resolver.resolve(url);

    if (!adapter) {
      throw new Error("Nenhum adapter encontrado para esta URL.");
    }

    const rawProducts = await adapter.discover(url);

    const items: NormalizedProduct[] = [];
    let duplicatesCount = 0;

    for (const raw of rawProducts) {
      // Basic normalization
      const normalized: NormalizedProduct = {
        externalId: raw.externalId,
        sourceUrl: raw.url,
        title: raw.title,
        description: raw.description ?? null,
        supplierCost: raw.price,
        basePricePub: PricingService.calculatePubBasePrice(raw.price),
        sku: raw.sku || `SKU-${raw.externalId}`,
        images: raw.images,
        category: raw.category ?? null,
        metadata: raw.metadata ?? null,
      };

      // Real Deduplication Check
      const existing = await masterProductRepository.findBySku(normalized.sku);
      if (existing) {
        duplicatesCount++;
      }

      items.push(normalized);
    }

    // Extract metadata from raw results if available
    const firstRawMetadata = rawProducts[0]?.metadata?.["worker_metadata"];

    return {
      supplierName: "Fornecedor Detectado",
      sourceUrl: url,
      totalFound: items.length,
      newItems: items.length - duplicatesCount,
      updates: 0,
      duplicates: duplicatesCount,
      errors: 0,
      items,
      metadata: {
        shopId: firstRawMetadata?.shopId || null,
        executionTime: firstRawMetadata?.executionTime || 0,
        errors: firstRawMetadata?.errors || [],
      },
    };
  }

  async confirmImport(items: NormalizedProduct[], supplierId: string): Promise<void> {
    console.log(`[CatalogIngestionService] Confirming import for ${items.length} items`);

    for (const item of items) {
      try {
        await masterProductRepository.upsert({
          supplierId,
          sku: item.sku,
          name: item.title,
          description: item.description,
          imageUrl: item.images[0] ?? null,
          category: item.category,
          supplierCost: item.supplierCost,
          basePricePub: item.basePricePub,
          status: "active",
          isAvailable: true,
          metadata: {
            ...item.metadata,
            external_id: item.externalId,
            source_url: item.sourceUrl,
          },
        });
      } catch (error) {
        console.error(`[CatalogIngestionService] Failed to import item ${item.sku}:`, error);
        // Continue with next items
      }
    }
  }
}

export const catalogIngestionService = new CatalogIngestionService();
