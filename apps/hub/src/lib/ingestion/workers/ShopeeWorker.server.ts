// Note: This file is intended to run in a Node.js environment.
// To avoid build-time bundling issues with Playwright in Cloudflare Workers/Edge runtimes,
// we use dynamic requirements that only execute when the environment supports them.

interface WorkerParams {
  url: string;
  shopId?: string;
  limit: number;
  pageSize: number;
}

interface WorkerResult {
  items: any[];
  errors: string[];
  shopId: string | null;
  executionTime: number;
}

function validateUrl(url: string) {
  const parsed = new URL(url);

  // Accept only shopee.com.br and its legitimate subdomains
  const hostname = parsed.hostname.toLowerCase();
  const isLegitShopee = hostname === "shopee.com.br" || hostname.endsWith(".shopee.com.br");

  if (!isLegitShopee) {
    throw new Error("Domínio não permitido. Apenas shopee.com.br é aceito.");
  }

  // Block local/private IPs and sensitive endpoints
  const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254"];
  if (blockedHostnames.includes(hostname)) {
    throw new Error("Origem inválida.");
  }

  // Strict protocol check
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Protocolo não suportado.");
  }
}

export async function runShopeeWorker(params: WorkerParams): Promise<WorkerResult> {
  const startTime = Date.now();
  const { url, limit, shopId: initialShopId } = params;
  const items: any[] = [];
  const errors: string[] = [];
  let detectedShopId: string | null = initialShopId || null;

  try {
    validateUrl(url);

    // In environments where Playwright is not supported (like Cloudflare Workers),
    // we attempt a direct fetch approach if possible, or fail gracefully.
    // For local dev and Node.js environments, we use Playwright.

    console.log(`[ShopeeWorker] Starting execution for: ${url}`);

    // Dynamic import to prevent bundling errors
    let playwright;
    try {
      playwright = await import("playwright");
    } catch (e) {
      console.warn("[ShopeeWorker] Playwright not found in bundle, trying direct API approach.");
    }

    if (playwright && playwright.chromium) {
      const browser = await playwright.chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 1800 },
      });
      const page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

        if (!detectedShopId) {
          detectedShopId = (await page.evaluate((currentUrl) => {
            // Priority 1: URL format /shop/{id}
            const urlMatch = currentUrl.match(/\/shop\/(\d+)/);
            if (urlMatch && urlMatch[1]) return urlMatch[1];

            // Priority 2: Scripts
            const scripts = Array.from(document.querySelectorAll("script"));
            for (const script of scripts) {
              const match = script.innerHTML.match(/shopid["\s:]+(\d+)/);
              if (match && match[1] && match[1] !== "0") return match[1];
            }

            // Priority 3: Product URL format /product/{shopid}/{itemid}
            const productMatch = currentUrl.match(/\/product\/(\d+)/);
            if (productMatch && productMatch[1]) return productMatch[1];

            return null;
          }, url)) as string | null;
        }

        if (!detectedShopId) {
          throw new Error("Não foi possível identificar o ID da loja.");
        }

        let offset = 0;
        let pageCount = 0;

        while (items.length < limit) {
          pageCount++;
          console.log(`[ShopeeWorker] Processing page ${pageCount} (offset ${offset})...`);

          const pageResults: any = await page.evaluate(
            async ({ shopId, offset }) => {
              try {
                const api = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&limit=30&match_id=${shopId}&newest=${offset}&order=desc&page_type=shop&scenario=PAGE_SHOP&version=2`;

                // In browser context, we attempt to use the existing session and headers
                const response = await fetch(api, {
                  headers: {
                    "x-requested-with": "XMLHttpRequest",
                    referer: `https://shopee.com.br/shop/${shopId}`,
                    accept: "application/json, text/plain, */*",
                  },
                });

                if (response.status === 403) {
                  // If 403, we try one more time after a small scroll to simulate activity
                  await new Promise((r) => setTimeout(r, 2000));
                  window.scrollTo(0, document.body.scrollHeight / 2);
                  const retryResp = await fetch(api, {
                    headers: { "x-requested-with": "XMLHttpRequest" },
                  });
                  if (retryResp.status === 403)
                    return { error: "HTTP 403 Forbidden - O acesso foi bloqueado pela Shopee." };
                  if (!retryResp.ok) return { error: `HTTP ${retryResp.status}` };
                  const retryData = await retryResp.json();
                  return { items: retryData.items || [] };
                }

                if (!response.ok) return { error: `HTTP ${response.status}` };
                const data = await response.json();
                return { items: data.items || [] };
              } catch (e: any) {
                return { error: e.message };
              }
            },
            { shopId: detectedShopId, offset },
          );

          if (pageResults.error) {
            errors.push(`Erro na página ${pageCount}: ${pageResults.error}`);
            break;
          }

          const newItems = pageResults.items.map((i: any) => i.item_basic);
          if (!newItems || newItems.length === 0) {
            console.log(`[ShopeeWorker] No more items found at page ${pageCount}`);
            break;
          }

          items.push(...newItems);
          console.log(
            `[ShopeeWorker] Found ${newItems.length} items on page ${pageCount}. Total so far: ${items.length}`,
          );

          offset += newItems.length;

          // Small delay to be polite
          await new Promise((r) => setTimeout(r, 1000));
        }
      } finally {
        await browser.close();
      }
    } else {
      // Fallback: This is where we would implement a proxy-based fetch if browser automation is blocked
      errors.push("Ambiente de execução não suporta automação de browser direta.");
    }
  } catch (error: any) {
    console.error(`[ShopeeWorker] Error:`, error);
    errors.push(error.message);
  }

  return {
    items: items.slice(0, limit),
    errors,
    shopId: detectedShopId,
    executionTime: Date.now() - startTime,
  };
}
