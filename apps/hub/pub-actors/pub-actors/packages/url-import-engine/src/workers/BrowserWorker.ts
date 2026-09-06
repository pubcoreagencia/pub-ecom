import puppeteer from "@cloudflare/puppeteer";
import { BrowserCollectorOutput } from "../../../browser-collector/src/BrowserCollector.js";

export type BrowserPageClassification =
  | "PRODUCT_PAGE"
  | "INTERSTITIAL"
  | "CAPTCHA"
  | "ACCOUNT_VERIFICATION"
  | "ACCESS_DENIED"
  | "EMPTY";

export interface BrowserWorkerResult {
  success: boolean;
  collectorOutput: BrowserCollectorOutput | null;
  durationMs: number;
  error?: string;
  classification?: BrowserPageClassification;
  isBlockedInterstitial?: boolean;
}

export class BrowserWorker {
  private static CHROME_EXECUTABLE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  /**
   * Executes headless browser session, renders page and collects product data
   */
  static async renderAndCollect(url: string, env: any, timeoutMs = 25000): Promise<BrowserWorkerResult> {
    const startTime = Date.now();
    let browser: any = null;

    try {
      let page: any = null;

      if (env?.BROWSER) {
        browser = await puppeteer.launch(env.BROWSER);
        page = await browser.newPage();
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        );
        await page.setViewport({ width: 1920, height: 1080 });
        try {
          await page.setExtraHTTPHeaders({
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
          });
        } catch (_) {}

        try {
          await page.evaluateOnNewDocument(() => {
            try {
              delete (Object.getPrototypeOf(navigator) as any).webdriver;
            } catch (_) {}
            Object.defineProperty(navigator, "webdriver", {
              get: () => undefined,
            });
            Object.defineProperty(navigator, "platform", {
              get: () => "Win32",
            });
            if ((navigator as any).userAgentData) {
              Object.defineProperty((navigator as any).userAgentData, "platform", {
                get: () => "Windows",
              });
            }
            try {
              Object.defineProperty(window.screen, "width", { get: () => 1920 });
              Object.defineProperty(window.screen, "height", { get: () => 1080 });
              Object.defineProperty(window.screen, "availWidth", { get: () => 1920 });
              Object.defineProperty(window.screen, "availHeight", { get: () => 1040 });
            } catch (_) {}
            try {
              const origResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
              Intl.DateTimeFormat.prototype.resolvedOptions = function () {
                const res = origResolved.apply(this, arguments as any);
                res.timeZone = "America/Sao_Paulo";
                res.locale = "pt-BR";
                return res;
              };
            } catch (_) {}
            try {
              const getParameter = WebGLRenderingContext.prototype.getParameter;
              WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
                if (parameter === 37445) return "Google Inc. (NVIDIA)";
                if (parameter === 37446)
                  return "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)";
                return getParameter.apply(this, [parameter]);
              };
            } catch (_) {}
            Object.defineProperty(navigator, "plugins", {
              get: () => [
                { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format" },
                { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "" },
                { name: "Native Client", filename: "internal-nacl-plugin", description: "" },
              ],
            });
            Object.defineProperty(navigator, "languages", {
              get: () => ["pt-BR", "pt", "en-US", "en"],
            });
            (window as any).chrome = {
              app: { isInstalled: false },
              runtime: {
                OnInstalledReason: { CHROME_UPDATE: "chrome_update" },
              },
            };
          });
        } catch (_) {}
      } else if (puppeteer && typeof puppeteer.launch === "function") {
        browser = await puppeteer.launch();
        page = await browser.newPage();
      } else {
        throw new Error("Nenhum runtime BROWSER disponível no ambiente");
      }

      page.setDefaultTimeout(timeoutMs);

      // Navigate to target URL
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      if (!response) {
        throw new Error("Página não respondeu à requisição");
      }

      const status = response.status();
      if (status >= 400) {
        throw new Error(`Servidor remoto retornou HTTP ${status}`);
      }

      // Allow hydration delay for client-side rendering (Shopee/MercadoLivre)
      await new Promise((r) => setTimeout(r, 4000));

      // Execute in-page extraction and page classification
      const rawExtraction = await page.evaluate(() => {
        const doc = document;
        const win = window as any;
        const fullBodyText = doc.body?.innerText || "";
        const curUrl = win.location?.href || "";
        const docTitle = doc.title || "";

        let classification: BrowserPageClassification = "EMPTY";

        if (!doc.body || fullBodyText.trim().length === 0) {
          classification = "EMPTY";
        } else if (
          curUrl.includes("account-verification") ||
          curUrl.includes("negative_traffic") ||
          fullBodyText.includes("Para continuar, acesse sua conta") ||
          fullBodyText.includes("gz-account-verification") ||
          docTitle.includes("Verificação")
        ) {
          classification = "ACCOUNT_VERIFICATION";
        } else if (
          fullBodyText.includes("cf-turnstile") ||
          fullBodyText.includes("g-recaptcha") ||
          fullBodyText.includes("hcaptcha") ||
          fullBodyText.includes("robot or human") ||
          fullBodyText.includes("Security Check") ||
          docTitle.includes("CAPTCHA")
        ) {
          classification = "CAPTCHA";
        } else if (
          docTitle.includes("Access Denied") ||
          docTitle.includes("403 Forbidden") ||
          docTitle.includes("Blocked") ||
          fullBodyText.includes("Access Denied")
        ) {
          classification = "ACCESS_DENIED";
        }

        // Title: DOM > Meta > doc.title > JSON-LD
        let title: string | null = null;
        const titleEl = doc.querySelector("h1.ui-pdp-title, h1#title, h1#productTitle, .shopee-product-detail h1, [class*='product-briefing'] h1, [class*='product-briefing'] span, div._44qnta, span.TSg3A_, h1");
        if (titleEl) {
          title = (titleEl as HTMLElement).innerText.trim();
        }
        if (!title) {
          const ogTitle = doc.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
          if (ogTitle) title = ogTitle.getAttribute("content")?.trim() || null;
        }
        if (!title && docTitle && !docTitle.includes("Verificação") && !docTitle.includes("Access Denied")) {
          title = docTitle.replace(/\s*(\|.*|-.*|Shopee.*|Mercado Libre.*)$/i, "").trim();
        }

        // Price: Fraction/Cents > Meta > Regex in text > JSON-LD
        let price: number | null = null;
        const mlFrac = doc.querySelector(".andes-money-amount__fraction");
        if (mlFrac) {
          const raw = (mlFrac as HTMLElement).innerText.trim();
          const cents = (doc.querySelector(".andes-money-amount__cents") as HTMLElement)?.innerText.replace(/[^0-9]/g, "") || "00";
          if (raw.includes(".")) price = parseFloat(raw.replace(/\./g, "").replace(",", "."));
          else price = parseFloat(`${raw.replace(/\./g, "")}.${cents}`);
        }

        if (!price) {
          const shopeePrice = doc.querySelector(".pqTWkA, .Y3d2A, [class*='shopee-price'], [class*='product-price'], div.G27ShH, div.B-8e4A, div._12kQ79, span._3n5zSv");
          if (shopeePrice) {
            const m = (shopeePrice as HTMLElement).innerText.replace(/\./g, "").replace(",", ".").match(/[\d.]+/);
            if (m) price = parseFloat(m[0]);
          }
        }

        if (!price) {
          const amzWhole = doc.querySelector(".a-price-whole");
          if (amzWhole) {
            const amzFrac = doc.querySelector(".a-price-fraction");
            const w = (amzWhole as HTMLElement).innerText.replace(/[^0-9]/g, "");
            const f = amzFrac ? (amzFrac as HTMLElement).innerText.replace(/[^0-9]/g, "") : "00";
            price = parseFloat(`${w}.${f}`);
          }
        }

        if (!price) {
          const priceMeta = doc.querySelector('meta[property="product:price:amount"], meta[itemprop="price"], meta[property="og:price:amount"]');
          if (priceMeta) {
            const v = parseFloat(priceMeta.getAttribute("content") || "");
            if (!isNaN(v) && v > 0) price = v;
          }
        }

        if (!price && classification !== "ACCOUNT_VERIFICATION" && classification !== "ACCESS_DENIED") {
          const pm = fullBodyText.match(/R\$\s*([\d\.]+,\d{2})/i);
          if (pm) {
            price = parseFloat(pm[1].replace(/\./g, "").replace(",", "."));
          }
        }

        // Images: Gallery > Meta > all imgs
        const images: string[] = [];
        const imgEls = doc.querySelectorAll(".ui-pdp-gallery__figure img, #imgTagWrapperId img, #landingImage, .shopee-product-detail img, img[data-zoom], img[src*='susercontent'], img[src*='shopee'], img[src*='cf.shopee']");
        imgEls.forEach((el) => {
          const src = el.getAttribute("data-zoom") || el.getAttribute("data-src") || el.getAttribute("data-old-hires") || (el as HTMLImageElement).src;
          if (src && src.startsWith("http") && !src.includes("placeholder") && !src.includes("data:image")) {
            if (!images.includes(src)) images.push(src);
          }
        });

        if (images.length === 0 && classification !== "ACCOUNT_VERIFICATION") {
          const ogImg = doc.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
          if (ogImg) {
            const src = ogImg.getAttribute("content");
            if (src && src.startsWith("http") && !images.includes(src)) images.push(src);
          }
        }

        if (images.length === 0 && classification !== "ACCOUNT_VERIFICATION") {
          const allImgs = doc.querySelectorAll("img[src*='mlstatic.com'], img[src*='susercontent'], img[src*='http']");
          allImgs.forEach((img) => {
            const src = img.getAttribute("data-zoom") || img.getAttribute("src");
            if (src && src.startsWith("http") && !src.includes("data:image") && !src.includes("pixel") && !images.includes(src)) {
              images.push(src);
            }
          });
        }

        // JSON-LD
        let jsonldTitle: string | null = null;
        let jsonldPrice: number | null = null;
        let jsonldBrand: string | null = null;
        let jsonldDesc: string | null = null;

        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        scripts.forEach((s) => {
          try {
            const parsed = JSON.parse(s.textContent || "");
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              if (item["@type"] === "Product" || item.name) {
                if (item.name && !jsonldTitle) jsonldTitle = item.name;
                if (item.description && !jsonldDesc) jsonldDesc = item.description;
                if (item.brand?.name && !jsonldBrand) jsonldBrand = item.brand.name;
                if (item.offers) {
                  const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                  const rawP = offer?.price || offer?.lowPrice || offer?.highPrice;
                  if (rawP && !jsonldPrice) jsonldPrice = parseFloat(String(rawP).replace(/[^0-9.]/g, ""));
                }
              }
            }
          } catch {}
        });

        // Hydration State
        let hydTitle: string | null = null;
        let hydPrice: number | null = null;
        if (win.__UNIVERSAL_DATA_FOR_REHYDRATION__?.productInfo) {
          hydTitle = win.__UNIVERSAL_DATA_FOR_REHYDRATION__.productInfo.title || null;
          hydPrice = parseFloat(win.__UNIVERSAL_DATA_FOR_REHYDRATION__.productInfo.price) || null;
        }

        // Description
        const descEl = doc.querySelector(".ui-pdp-description__content, #productDescription, [class*='description']");
        const domDesc = descEl ? (descEl as HTMLElement).innerText.trim() : null;

        const finalTitle = title || jsonldTitle || hydTitle;
        const finalPrice = price || jsonldPrice || hydPrice || 0;
        const finalBrand = jsonldBrand || null;
        const finalDesc = domDesc || jsonldDesc || null;

        if (classification === "EMPTY") {
          if (finalTitle || images.length > 0) {
            classification = "PRODUCT_PAGE";
          }
        }

        const sampleText = fullBodyText.replace(/\s+/g, " ").slice(0, 150);

        return {
          title: classification === "PRODUCT_PAGE" ? finalTitle : null,
          titleSource: title ? "dom" : jsonldTitle ? "jsonld" : hydTitle ? "hydration" : "unknown",
          price: classification === "PRODUCT_PAGE" ? finalPrice : null,
          priceSource: price ? "dom" : jsonldPrice ? "jsonld" : hydPrice ? "hydration" : "unknown",
          images: classification === "PRODUCT_PAGE" ? images : [],
          brand: classification === "PRODUCT_PAGE" ? finalBrand : null,
          description: classification === "PRODUCT_PAGE" ? finalDesc : null,
          sampleText,
          curUrl,
          classification,
        };
      });

      await page.close().catch(() => {});
      await browser.close().catch(() => {});

      const durationMs = Date.now() - startTime;
      const isComplete = Boolean(
        rawExtraction.classification === "PRODUCT_PAGE" &&
        rawExtraction.title &&
        rawExtraction.price &&
        rawExtraction.images.length > 0
      );
      const isBlocked = rawExtraction.classification !== "PRODUCT_PAGE";

      console.log('[BROWSER_TRACE] extracted', {
        classification: rawExtraction.classification,
        isComplete,
        hasTitle: Boolean(rawExtraction.title),
        titlePreview: rawExtraction.title ? rawExtraction.title.slice(0, 30) : null,
        hasPrice: rawExtraction.price !== null,
        priceVal: rawExtraction.price,
        imagesCount: rawExtraction.images.length,
      });

      const fieldDiag = `classification=${rawExtraction.classification},curUrl=${rawExtraction.curUrl},title=${rawExtraction.title},price=${rawExtraction.price},imgs=${rawExtraction.images.length}`;

      return {
        success: isComplete,
        isBlockedInterstitial: isBlocked,
        classification: rawExtraction.classification as BrowserPageClassification,
        collectorOutput: {
          status: isComplete ? "SUCCESS" : (isBlocked ? "BLOCKED" : "INCOMPLETE"),
          marketplace: "browser_rendered",
          url,
          productId: "ITEM_1",
          shopId: null,
          durationMs,
          error: isComplete ? undefined : fieldDiag,
          auditedProduct: {
            source: { value: "browser_rendered", source: "dom" },
            sourceUrl: { value: url, source: "dom" },
            externalId: { value: "ITEM_1", source: "dom" },
            title: { value: rawExtraction.title, source: rawExtraction.titleSource as any },
            price: { value: rawExtraction.price, source: rawExtraction.priceSource as any },
            currency: { value: "BRL", source: "dom" },
            images: { value: rawExtraction.images, source: "dom" },
            description: { value: rawExtraction.description, source: "jsonld" },
            brand: { value: rawExtraction.brand, source: "jsonld" },
            totalRealFields: [rawExtraction.title, rawExtraction.price, rawExtraction.images.length > 0].filter(Boolean).length,
            isComplete,
          },
          canonicalProduct: null,
          sourcesFound: { dom: true, jsonld: true, meta: false, hydration: true, network: false },
          totalRealFields: isComplete ? 3 : 0,
        },
        durationMs,
      };
    } catch (err: any) {
      console.log('[BROWSER_TRACE] error', { error: err.message || String(err) });
      if (browser) await browser.close().catch(() => {});
      return {
        success: false,
        isBlockedInterstitial: false,
        collectorOutput: null,
        durationMs: Date.now() - startTime,
        error: err.message || String(err),
      };
    }
  }
}
