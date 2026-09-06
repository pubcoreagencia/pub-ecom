export interface DomExtractionResult {
  title?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
  images: string[];
  description?: string | null;
  variants: Array<{ name: string; price?: number; image?: string; stock?: number }>;
  rating?: number | null;
  soldCount?: number | null;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
}

export function extractFromDom(document: Document, marketplace: string): DomExtractionResult {
  const result: DomExtractionResult = { images: [], variants: [] };

  // 1. TITLE HEURISTICS
  const titleEl = document.querySelector(
    "h1.ui-pdp-title, h1#title, h1#productTitle, h1.product-title, .shopee-product-detail h1, h1"
  );
  if (titleEl && titleEl.textContent) {
    const raw = titleEl.textContent.trim();
    if (raw.length > 2) result.title = raw;
  }

  // 2. PRICE HEURISTICS
  // Shopee
  const shopeePrice = document.querySelector(".pqTWkA, .Y3d2A, ._3n5NQx, [class*='shopee-price']");
  if (shopeePrice && shopeePrice.textContent) {
    const pMatch = shopeePrice.textContent.replace(/\./g, "").replace(",", ".").match(/[\d.]+/);
    if (pMatch) result.price = parseFloat(pMatch[0]);
  }

  // Mercado Livre
  if (!result.price) {
    const mlFraction = document.querySelector(".ui-pdp-price__second-line .andes-money-amount__fraction, .andes-money-amount__fraction");
    const mlCents = document.querySelector(".ui-pdp-price__second-line .andes-money-amount__cents, .andes-money-amount__cents");
    if (mlFraction && mlFraction.textContent) {
      const frac = mlFraction.textContent.replace(/\./g, "");
      const cents = mlCents && mlCents.textContent ? mlCents.textContent : "00";
      result.price = parseFloat(`${frac}.${cents}`);
    }
  }

  // Amazon
  if (!result.price) {
    const amzWhole = document.querySelector(".a-price-whole, #corePriceDisplay_desktop_feature_div .a-price-whole");
    const amzFrac = document.querySelector(".a-price-fraction, #corePriceDisplay_desktop_feature_div .a-price-fraction");
    if (amzWhole && amzWhole.textContent) {
      const whole = amzWhole.textContent.replace(/[^0-9]/g, "");
      const frac = amzFrac && amzFrac.textContent ? amzFrac.textContent.replace(/[^0-9]/g, "") : "00";
      result.price = parseFloat(`${whole}.${frac}`);
    }
  }

  // Generic fallback
  if (!result.price) {
    const anyPriceEl = document.querySelector("[class*='price'], [id*='price'], [itemprop='price']");
    if (anyPriceEl && anyPriceEl.textContent) {
      const m = anyPriceEl.textContent.replace(/\./g, "").replace(",", ".").match(/[\d.]+/);
      if (m && parseFloat(m[0]) > 0) result.price = parseFloat(m[0]);
    }
  }

  // 3. IMAGES HEURISTICS
  const imgEls = document.querySelectorAll(
    ".ui-pdp-gallery__figure img, #imgTagWrapperId img, #landingImage, .shopee-product-detail img, [class*='gallery'] img, [class*='product-image'] img, img[data-zoom]"
  );

  imgEls.forEach((el: Element) => {
    const img = el as HTMLImageElement;
    const src = img.getAttribute("data-zoom") || img.getAttribute("data-old-hires") || img.src;
    if (src && src.startsWith("http") && !src.includes("placeholder") && !src.includes("data:image")) {
      if (!result.images.includes(src)) result.images.push(src);
    }
  });

  // 4. DESCRIPTION
  const descEl = document.querySelector(
    ".ui-pdp-description__content, #productDescription, ._2u0jt9, [class*='description'], [itemprop='description']"
  );
  if (descEl && descEl.textContent) {
    const text = descEl.textContent.trim();
    if (text.length > 5) result.description = text;
  }

  // 5. RATING
  const ratingEl = document.querySelector(".ui-pdp-review__rating, .a-icon-alt, [class*='rating-score']");
  if (ratingEl && ratingEl.textContent) {
    const rMatch = ratingEl.textContent.replace(",", ".").match(/[\d.]+/);
    if (rMatch) result.rating = parseFloat(rMatch[0]);
  }

  return result;
}
