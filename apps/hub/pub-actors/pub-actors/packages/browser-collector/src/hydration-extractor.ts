export interface HydrationExtractionResult {
  title?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
  images: string[];
  description?: string | null;
  variants: Array<{ name: string; price?: number; stock?: number; sku?: string }>;
  rating?: number | null;
  soldCount?: number | null;
  brand?: string | null;
  category?: string | null;
  stock?: number | null;
  foundHydrationKey?: string | null;
}

export function extractFromHydration(windowObj: any): HydrationExtractionResult {
  const result: HydrationExtractionResult = { images: [], variants: [] };

  const candidateKeys = [
    "__UNIVERSAL_DATA_FOR_REHYDRATION__",
    "__INITIAL_STATE__",
    "__PRELOADED_STATE__",
    "__NEXT_DATA__",
    "__NUXT__",
    "SIGI_STATE",
    "_state",
  ];

  for (const key of candidateKeys) {
    let data = windowObj[key];

    // If script tag contains json
    if (!data && typeof document !== "undefined") {
      const el = document.getElementById(key) || document.querySelector(`script[id*='${key}']`);
      if (el && el.textContent) {
        try {
          data = JSON.parse(el.textContent);
        } catch {}
      }
    }

    if (data && typeof data === "object") {
      result.foundHydrationKey = key;

      // Deep scan for product-like structures
      const findProductRecursive = (obj: any, depth = 0): void => {
        if (!obj || depth > 5) return;

        if (obj.title || obj.name || obj.item_name || obj.product_name) {
          const candidateTitle = String(obj.title || obj.name || obj.item_name || obj.product_name).trim();
          if (candidateTitle.length > 3 && !result.title) {
            result.title = candidateTitle;
          }
        }

        if (obj.price || obj.realPrice || obj.min_price || obj.current_price) {
          const candidatePrice = parseFloat(String(obj.price || obj.realPrice || obj.min_price || obj.current_price));
          if (candidatePrice > 0 && !result.price) {
            result.price = candidatePrice;
          }
        }

        if (Array.isArray(obj.images) || Array.isArray(obj.image_list) || Array.isArray(obj.pictures)) {
          const imgs = obj.images || obj.image_list || obj.pictures;
          imgs.forEach((im: any) => {
            const src = typeof im === "string" ? im : im.url || im.secure_url;
            if (src && typeof src === "string" && src.startsWith("http") && !result.images.includes(src)) {
              result.images.push(src);
            }
          });
        }

        if (obj.description || obj.item_desc) {
          const desc = String(obj.description || obj.item_desc).trim();
          if (desc.length > 5 && !result.description) result.description = desc;
        }

        if (obj.brand_name || obj.brand) {
          const b = String(obj.brand_name || obj.brand).trim();
          if (b && !result.brand) result.brand = b;
        }

        // Traverse child objects
        if (typeof obj === "object") {
          for (const k of Object.keys(obj)) {
            if (typeof obj[k] === "object") {
              findProductRecursive(obj[k], depth + 1);
            }
          }
        }
      };

      findProductRecursive(data);
      if (result.title || result.price) break;
    }
  }

  return result;
}
