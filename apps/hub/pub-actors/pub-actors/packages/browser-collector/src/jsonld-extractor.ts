export interface JsonLdExtractionResult {
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  images: string[];
  description?: string | null;
  sku?: string | null;
  brand?: string | null;
  rating?: number | null;
  soldCount?: number | null;
  category?: string | null;
}

export function extractFromJsonLd(document: Document): JsonLdExtractionResult {
  const result: JsonLdExtractionResult = { images: [] };
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  scripts.forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent || "");
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (item["@type"] === "Product" || item.name) {
          if (item.name && !result.title) result.title = String(item.name).trim();
          if (item.description && !result.description) result.description = String(item.description).trim();
          if (item.sku && !result.sku) result.sku = String(item.sku);
          if (item.brand?.name && !result.brand) result.brand = String(item.brand.name);
          if (item.category && !result.category) result.category = String(item.category);

          if (item.image) {
            const rawImages = Array.isArray(item.image) ? item.image : [item.image];
            rawImages.forEach((img: any) => {
              const src = typeof img === "string" ? img : img.url;
              if (src && typeof src === "string" && src.startsWith("http") && !result.images.includes(src)) {
                result.images.push(src);
              }
            });
          }

          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offer && offer.price && !result.price) {
              result.price = parseFloat(String(offer.price || offer.lowPrice));
            }
            if (offer && offer.priceCurrency && !result.currency) {
              result.currency = String(offer.priceCurrency);
            }
          }

          if (item.aggregateRating) {
            if (item.aggregateRating.ratingValue && !result.rating) {
              result.rating = parseFloat(String(item.aggregateRating.ratingValue));
            }
            if (item.aggregateRating.reviewCount && !result.soldCount) {
              result.soldCount = parseInt(String(item.aggregateRating.reviewCount), 10);
            }
          }
        }
      }
    } catch {}
  });

  return result;
}
