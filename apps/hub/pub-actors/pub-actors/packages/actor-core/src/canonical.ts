import { z } from "zod";

/**
 * Universal E-commerce Variant Schema
 */
export const PubEcomVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().nullable().optional(),
  sku: z.string().nullable().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  image: z.string().url().nullable().optional(),
  options: z.record(z.string()).optional(),
});

export type PubEcomVariant = z.infer<typeof PubEcomVariantSchema>;

/**
 * Universal Canonical E-commerce Product Schema (PubEcomProduct)
 * Source-agnostic: designed to represent products from Shopee, Mercado Livre, Amazon, AliExpress, etc.
 */
export const PubEcomProductSchema = z.object({
  id: z.string(), // Format: `${source}:${shopId}:${externalId}`
  externalId: z.string().min(1),
  source: z.enum(["shopee", "mercadolivre", "amazon", "aliexpress", "tiktokshop", "generic"]),
  sourceUrl: z.string().url(),
  storeId: z.string().nullable().optional(),
  shopId: z.string().nullable().optional(),
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().nullable().optional(),
  currency: z.string().length(3).default("BRL"),
  images: z.array(z.string().url()).min(1),
  thumbnail: z.string().url().nullable().optional(),
  variants: z.array(PubEcomVariantSchema).default([]),
  sku: z.string().nullable().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  soldCount: z.number().int().nonnegative().nullable().optional(),
  category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  attributes: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({}),
  extractionLevel: z.string(),
  extractedAt: z.string(),
});

export type PubEcomProduct = z.infer<typeof PubEcomProductSchema>;

/**
 * Parsing helper to extract shopId and itemId from any canonical Shopee URL
 */
export function parseShopeeUrl(url: string): { shopId: string | null; itemId: string | null; username: string | null } {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Pattern 1: /product-name-i.123456789.9876543210
    const iMatch = pathname.match(/-i\.(\d+)\.(\d+)/);
    if (iMatch) {
      return { shopId: iMatch[1], itemId: iMatch[2], username: null };
    }

    // Pattern 2: /product/123456789/9876543210
    const prodMatch = pathname.match(/\/product\/(\d+)\/(\d+)/);
    if (prodMatch) {
      return { shopId: prodMatch[1], itemId: prodMatch[2], username: null };
    }

    // Pattern 3: Store URL /username
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 1 && !segments[0].includes(".")) {
      return { shopId: null, itemId: null, username: segments[0] };
    }

    return { shopId: null, itemId: null, username: null };
  } catch {
    return { shopId: null, itemId: null, username: null };
  }
}

/**
 * Shopee Raw to Canonical Normalizer
 */
export function normalizeShopeeRawToCanonical(raw: Record<string, any>): {
  success: boolean;
  product?: PubEcomProduct;
  error?: string;
} {
  // Reject explicitly flagged mocks or synthetic samples
  if (raw._mock === true || (raw._notice && String(raw._notice).includes("MOCK"))) {
    return { success: false, error: "Mock data rejected: item contains synthetic _mock flag" };
  }

  const sourceUrl = raw.url || raw.sourceUrl || raw.productUrl || "";
  const { shopId: parsedShopId, itemId: parsedItemId } = parseShopeeUrl(sourceUrl);

  const shopId = raw.shopId || raw.shop_id || parsedShopId;
  const itemId = raw.itemId || raw.item_id || raw.itemid || parsedItemId;

  if (!itemId || !shopId) {
    return { success: false, error: "Invalid product: missing itemId or shopId" };
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : typeof raw.name === "string" ? raw.name.trim() : "";
  if (!title || title.length < 3 || title.includes("Https://shopee.com.br/")) {
    return { success: false, error: "Invalid product: missing or synthetic title" };
  }

  const rawPrice = raw.price ?? raw.currentPrice ?? raw.priceMin;
  const price = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice || "").replace(/[^0-9.]/g, ""));
  if (!price || isNaN(price) || price <= 0) {
    return { success: false, error: "Invalid product: price must be a positive number" };
  }

  // Normalize Images
  let images: string[] = [];
  if (Array.isArray(raw.images)) {
    images = raw.images.filter((img) => typeof img === "string" && img.startsWith("http"));
  } else if (typeof raw.image === "string" && raw.image.startsWith("http")) {
    images = [raw.image];
  }

  // Reject placeholder mock images
  images = images.filter((img) => !img.includes("mock_"));
  if (images.length === 0) {
    return { success: false, error: "Invalid product: at least one real image URL is required" };
  }

  // Normalize Variants
  const variants: PubEcomVariant[] = [];
  if (Array.isArray(raw.variants)) {
    for (const v of raw.variants) {
      if (v && v.name && typeof v.price === "number") {
        variants.push({
          id: String(v.id || variants.length + 1),
          name: String(v.name).trim(),
          price: v.price > 0 ? v.price : price,
          compareAtPrice: v.compareAtPrice || null,
          sku: v.sku || null,
          stock: typeof v.stock === "number" ? v.stock : null,
          image: typeof v.image === "string" ? v.image : null,
          options: v.options || {},
        });
      }
    }
  }

  const canonical: PubEcomProduct = {
    id: `shopee:${shopId}:${itemId}`,
    externalId: String(itemId),
    source: "shopee",
    sourceUrl,
    storeId: raw.storeId || `shopee:${shopId}`,
    shopId: String(shopId),
    title,
    description: typeof raw.description === "string" ? raw.description.trim() : null,
    price,
    compareAtPrice: typeof raw.compareAtPrice === "number" ? raw.compareAtPrice : null,
    currency: "BRL",
    images,
    thumbnail: images[0] || null,
    variants,
    sku: typeof raw.sku === "string" ? raw.sku : null,
    stock: typeof raw.stock === "number" ? raw.stock : null,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    soldCount: typeof raw.soldCount === "number" ? raw.soldCount : null,
    category: typeof raw.category === "string" ? raw.category : null,
    brand: typeof raw.brand === "string" ? raw.brand : null,
    attributes: raw.attributes || {},
    metadata: {
      rawFieldsCount: Object.keys(raw).length,
      originalSource: "shopee_br",
    },
    extractionLevel: raw.extractionLevel || "unknown",
    extractedAt: raw.scrapedAt || new Date().toISOString(),
  };

  const validation = PubEcomProductSchema.safeParse(canonical);
  if (!validation.success) {
    return { success: false, error: `Schema validation failed: ${validation.error.message}` };
  }

  return { success: true, product: validation.data };
}
