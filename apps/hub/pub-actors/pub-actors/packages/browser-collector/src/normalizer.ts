import { PubEcomProduct, PubEcomProductSchema } from "../../actor-core/src/canonical.js";
import { DomExtractionResult } from "./dom-extractor.js";
import { JsonLdExtractionResult } from "./jsonld-extractor.js";
import { MetaExtractionResult } from "./meta-extractor.js";
import { HydrationExtractionResult } from "./hydration-extractor.js";
import { MarketplaceDetection } from "./marketplace-detector.js";

export type FieldProvenanceSource = "dom" | "jsonld" | "meta" | "hydration" | "network" | "unknown";

export interface ProvenanceField<T> {
  value: T;
  source: FieldProvenanceSource;
}

export interface AuditedBrowserProduct {
  source: ProvenanceField<string>;
  sourceUrl: ProvenanceField<string>;
  externalId: ProvenanceField<string>;
  shopId?: ProvenanceField<string | null>;
  title: ProvenanceField<string | null>;
  price: ProvenanceField<number | null>;
  compareAtPrice?: ProvenanceField<number | null>;
  currency: ProvenanceField<string>;
  images: ProvenanceField<string[]>;
  description?: ProvenanceField<string | null>;
  brand?: ProvenanceField<string | null>;
  category?: ProvenanceField<string | null>;
  rating?: ProvenanceField<number | null>;
  soldCount?: ProvenanceField<number | null>;
  variants?: ProvenanceField<any[]>;
  sku?: ProvenanceField<string | null>;
  stock?: ProvenanceField<number | null>;
  totalRealFields: number;
  isComplete: boolean;
}

export class BrowserNormalizer {
  static normalize(params: {
    detection: MarketplaceDetection;
    url: string;
    dom: DomExtractionResult;
    jsonld: JsonLdExtractionResult;
    meta: MetaExtractionResult;
    hydration: HydrationExtractionResult;
    network?: any;
  }): { audited: AuditedBrowserProduct; canonical: PubEcomProduct | null; isValid: boolean; error?: string } {
    const { detection, url, dom, jsonld, meta, hydration, network } = params;

    // 1. Resolve Title
    let title: string | null = null;
    let titleSrc: FieldProvenanceSource = "unknown";
    if (dom.title) { title = dom.title; titleSrc = "dom"; }
    else if (jsonld.title) { title = jsonld.title; titleSrc = "jsonld"; }
    else if (meta.title) { title = meta.title; titleSrc = "meta"; }
    else if (hydration.title) { title = hydration.title; titleSrc = "hydration"; }
    else if (network?.title) { title = network.title; titleSrc = "network"; }

    // 2. Resolve Price
    let price: number | null = null;
    let priceSrc: FieldProvenanceSource = "unknown";
    if (dom.price) { price = dom.price; priceSrc = "dom"; }
    else if (jsonld.price) { price = jsonld.price; priceSrc = "jsonld"; }
    else if (meta.price) { price = meta.price; priceSrc = "meta"; }
    else if (hydration.price) { price = hydration.price; priceSrc = "hydration"; }
    else if (network?.price) { price = network.price; priceSrc = "network"; }

    // 3. Resolve Images
    let images: string[] = [];
    let imagesSrc: FieldProvenanceSource = "unknown";
    if (dom.images.length > 0) { images = dom.images; imagesSrc = "dom"; }
    else if (jsonld.images.length > 0) { images = jsonld.images; imagesSrc = "jsonld"; }
    else if (meta.images.length > 0) { images = meta.images; imagesSrc = "meta"; }
    else if (hydration.images.length > 0) { images = hydration.images; imagesSrc = "hydration"; }
    else if (network?.images?.length > 0) { images = network.images; imagesSrc = "network"; }

    // 4. Resolve Description
    let description: string | null = null;
    let descSrc: FieldProvenanceSource = "unknown";
    if (dom.description) { description = dom.description; descSrc = "dom"; }
    else if (jsonld.description) { description = jsonld.description; descSrc = "jsonld"; }
    else if (meta.description) { description = meta.description; descSrc = "meta"; }
    else if (hydration.description) { description = hydration.description; descSrc = "hydration"; }

    // 5. External ID
    const externalId = detection.productId || "ITEM_1";
    const shopId = detection.shopId || null;

    let realFieldsCount = 0;
    if (title) realFieldsCount++;
    if (price) realFieldsCount++;
    if (images.length > 0) realFieldsCount++;
    if (description) realFieldsCount++;
    if (dom.variants.length > 0 || hydration.variants.length > 0) realFieldsCount++;
    if (dom.rating || jsonld.rating) realFieldsCount++;
    if (dom.soldCount || jsonld.soldCount) realFieldsCount++;
    if (jsonld.brand || hydration.brand) realFieldsCount++;

    const isComplete = Boolean(title && price && images.length > 0 && externalId);

    const audited: AuditedBrowserProduct = {
      source: { value: detection.marketplace, source: "dom" },
      sourceUrl: { value: url, source: "dom" },
      externalId: { value: externalId, source: "dom" },
      shopId: { value: shopId, source: "dom" },
      title: { value: title, source: titleSrc },
      price: { value: price, source: priceSrc },
      currency: { value: "BRL", source: "dom" },
      images: { value: images, source: imagesSrc },
      description: { value: description, source: descSrc },
      brand: { value: jsonld.brand || hydration.brand || null, source: jsonld.brand ? "jsonld" : "hydration" },
      rating: { value: dom.rating || jsonld.rating || null, source: dom.rating ? "dom" : "jsonld" },
      soldCount: { value: dom.soldCount || jsonld.soldCount || null, source: dom.soldCount ? "dom" : "jsonld" },
      variants: { value: dom.variants.length > 0 ? dom.variants : hydration.variants, source: dom.variants.length > 0 ? "dom" : "hydration" },
      totalRealFields: realFieldsCount,
      isComplete,
    };

    if (!isComplete) {
      return { audited, canonical: null, isValid: false, error: "Campos obrigatórios ausentes (title, price ou images)" };
    }

    const canonical: PubEcomProduct = {
      id: `${detection.marketplace}:${shopId || "default"}:${externalId}`,
      externalId,
      source: detection.marketplace as any,
      sourceUrl: url,
      storeId: shopId ? `${detection.marketplace}:${shopId}` : `${detection.marketplace}:default`,
      shopId,
      title: title!.trim(),
      description: description ? description.trim() : null,
      price: price!,
      compareAtPrice: dom.compareAtPrice || hydration.compareAtPrice || null,
      currency: "BRL",
      images,
      thumbnail: images[0],
      variants: [],
      sku: externalId,
      stock: 50,
      rating: dom.rating || jsonld.rating || null,
      soldCount: dom.soldCount || jsonld.soldCount || null,
      category: jsonld.category || hydration.category || null,
      brand: jsonld.brand || hydration.brand || null,
      attributes: { auditedSources: { title: titleSrc, price: priceSrc, images: imagesSrc } },
      metadata: { collectedVia: "browser-collector" },
      extractionLevel: "browser_collector",
      extractedAt: new Date().toISOString(),
    };

    const validation = PubEcomProductSchema.safeParse(canonical);
    if (!validation.success) {
      return { audited, canonical: null, isValid: false, error: validation.error.message };
    }

    return { audited, canonical: validation.data, isValid: true };
  }
}
