export interface MetaExtractionResult {
  title?: string | null;
  description?: string | null;
  images: string[];
  price?: number | null;
  currency?: string | null;
}

export function extractFromMeta(document: Document): MetaExtractionResult {
  const result: MetaExtractionResult = { images: [] };

  const getMeta = (prop: string): string | null => {
    const el = document.querySelector(`meta[property='${prop}'], meta[name='${prop}']`);
    return el ? el.getAttribute("content") : null;
  };

  const ogTitle = getMeta("og:title") || getMeta("twitter:title");
  if (ogTitle) result.title = ogTitle.trim();

  const ogDesc = getMeta("og:description") || getMeta("description");
  if (ogDesc) result.description = ogDesc.trim();

  const ogImage = getMeta("og:image") || getMeta("twitter:image");
  if (ogImage && ogImage.startsWith("http")) result.images.push(ogImage);

  const priceAmount = getMeta("product:price:amount") || getMeta("price");
  if (priceAmount) {
    const p = parseFloat(priceAmount.replace(/[^0-9.]/g, ""));
    if (p > 0) result.price = p;
  }

  const currency = getMeta("product:price:currency");
  if (currency) result.currency = currency;

  return result;
}
