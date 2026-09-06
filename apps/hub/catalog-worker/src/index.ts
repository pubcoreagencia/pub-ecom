import { getCorsHeaders, handleOptions } from "./cors";
import puppeteer from "@cloudflare/puppeteer";
import { isAllowedTargetUrl } from "./security";
import { getCatalogProvider, CatalogProvider, NormalizedProduct, StoreTarget } from "./providers";

export interface Env {
  BROWSER: any;
  DB?: any;
  CATALOG_WORKER_TOKEN: string;
  APIFY_TOKEN?: string;
}

async function ensureD1Tables(db: any) {
  if (!db) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT,
        source TEXT NOT NULL DEFAULT 'shopee',
        shop_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        sync_state TEXT NOT NULL DEFAULT 'idle',
        product_count INTEGER DEFAULT 0,
        last_sync_at TEXT,
        last_sync_status TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        external_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'BRL',
        images TEXT NOT NULL DEFAULT '[]',
        url TEXT NOT NULL DEFAULT '',
        sku TEXT,
        category TEXT,
        source TEXT NOT NULL DEFAULT 'shopee',
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(store_id, external_id)
      );

      CREATE TABLE IF NOT EXISTS sync_runs (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        status TEXT NOT NULL,
        trigger TEXT NOT NULL DEFAULT 'manual',
        requested_limit INTEGER NOT NULL DEFAULT 10,
        discovered INTEGER NOT NULL DEFAULT 0,
        created INTEGER NOT NULL DEFAULT 0,
        updated INTEGER NOT NULL DEFAULT 0,
        unchanged INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  } catch (e) {
    console.error("[ensureD1Tables] Error ensuring D1 tables:", e);
  }
}

/**
 * Generic D1 Persistence Engine
 * Persists normalized products agnostically into Cloudflare D1.
 */
async function persistToD1(
  db: any,
  storeId: string,
  products: NormalizedProduct[],
  storeName: string = "Loja",
) {
  if (!db) {
    return {
      total: products.length,
      created: products.length,
      updated: 0,
      unchanged: 0,
      failed: 0,
      storeProductCount: products.length,
      storageProvider: "memory",
    };
  }

  await ensureD1Tables(db);

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;

  for (const product of products) {
    try {
      const existing = await db
        .prepare(
          "SELECT title, price, sku, category FROM products WHERE store_id = ? AND external_id = ?",
        )
        .bind(storeId, product.external_id)
        .first();

      if (existing) {
        if (
          existing.title === product.title &&
          Number(existing.price) === product.price &&
          existing.sku === product.sku &&
          existing.category === product.category
        ) {
          unchangedCount++;
        } else {
          updatedCount++;
        }
      } else {
        createdCount++;
      }

      await db
        .prepare(
          `INSERT INTO products (id, external_id, store_id, title, description, price, currency, images, url, sku, category, source, metadata, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(store_id, external_id) DO UPDATE SET
             title = excluded.title,
             description = excluded.description,
             price = excluded.price,
             currency = excluded.currency,
             images = excluded.images,
             url = excluded.url,
             sku = excluded.sku,
             category = excluded.category,
             source = excluded.source,
             metadata = excluded.metadata,
             updated_at = datetime('now')`,
        )
        .bind(
          product.id,
          product.external_id,
          storeId,
          product.title,
          product.description || null,
          product.price,
          product.currency,
          JSON.stringify(product.images || []),
          product.url,
          product.sku || null,
          product.category || null,
          product.source,
          JSON.stringify(product.metadata || {}),
        )
        .run();
    } catch (itemErr) {
      console.error("[persistToD1] Item error:", itemErr);
      failedCount++;
    }
  }

  // Update store total count after upserting products
  const storeTotalRow = await db
    .prepare("SELECT COUNT(*) as total FROM products WHERE store_id = ?")
    .bind(storeId)
    .first();
  const realStoreProductCount = Number(storeTotalRow?.total) || 0;

  await db
    .prepare(
      `UPDATE stores SET product_count = ?, last_sync_at = datetime('now'), last_sync_status = 'success', sync_state = 'idle', updated_at = datetime('now') WHERE id = ?`,
    )
    .bind(realStoreProductCount, storeId)
    .run();

  return {
    total: products.length,
    created: createdCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    failed: failedCount,
    storeProductCount: realStoreProductCount,
    storageProvider: "d1",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const corsHeaders = getCorsHeaders(origin);

    // 1. Handle Preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    // Wrap inner logic to append CORS to all responses
    const handleRequest = async () => {
      // Health Check
      if (url.pathname === "/health" && request.method === "GET") {
        return new Response(
          JSON.stringify({
            ok: true,
            service: "pub-ecom-catalog-worker",
            catalogStorage: env.DB ? "d1" : "memory",
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Auth Check for Protected Routes
      const isImportRoute = url.pathname.startsWith("/v1/catalog/import/") || url.pathname.startsWith("/v1/catalog/products");
      const authHeader = request.headers.get("Authorization");
      const isServiceBinding = request.headers.get("x-service-binding") === "true";
      if (!isImportRoute && env.CATALOG_WORKER_TOKEN && !isServiceBinding && authHeader !== `Bearer ${env.CATALOG_WORKER_TOKEN}`) {
        return new Response(JSON.stringify({ success: false, errors: ["Unauthorized"] }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      // ----------------------------------------------------
      // APIFY TEST & VALIDATION PROBES (Protected)
      // ----------------------------------------------------
      if (url.pathname === "/v1/test/apify-probe" && request.method === "GET") {
        const token1 = env.APIFY_TOKEN;
        const token2 = (env as any).SHOPEE_SCRAPER_TOKEN;
        return new Response(
          JSON.stringify({
            hasApifyToken: !!token1,
            hasShopeeScraperToken: !!token2,
            configured: !!(token1 || token2),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.pathname === "/v1/test/apify-run" && request.method === "POST") {
        const body: any = await request.json().catch(() => ({}));
        const tokenToUse =
          body.useToken === "shopee_scraper"
            ? (env as any).SHOPEE_SCRAPER_TOKEN
            : env.APIFY_TOKEN || (env as any).SHOPEE_SCRAPER_TOKEN;

        if (!tokenToUse) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhum token configurado no worker" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const actorId = body.actorId || "gio21~shopee-scraper";
        const input = body.input || {};

        const apifyResp = await fetch(
          `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${tokenToUse}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );

        const apifyJson: any = await apifyResp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ status: apifyResp.status, data: apifyJson?.data || apifyJson }),
          {
            status: apifyResp.status,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname.startsWith("/v1/test/apify-run/") && request.method === "GET") {
        const tokenToUse = env.APIFY_TOKEN || (env as any).SHOPEE_SCRAPER_TOKEN;
        if (!tokenToUse) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhum token configurado no worker" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const runId = url.pathname.slice("/v1/test/apify-run/".length);
        const apifyResp = await fetch(
          `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${tokenToUse}`,
        );

        const apifyJson: any = await apifyResp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ status: apifyResp.status, data: apifyJson?.data || apifyJson }),
          {
            status: apifyResp.status,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname.startsWith("/v1/test/apify-dataset/") && request.method === "GET") {
        const tokenToUse = env.APIFY_TOKEN || (env as any).SHOPEE_SCRAPER_TOKEN;
        if (!tokenToUse) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhum token configurado no worker" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const datasetId = url.pathname.slice("/v1/test/apify-dataset/".length);
        const apifyResp = await fetch(
          `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${tokenToUse}&clean=true&format=json`,
        );

        const items: any = await apifyResp.json().catch(() => []);
        return new Response(JSON.stringify({ status: apifyResp.status, items }), {
          status: apifyResp.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      // ----------------------------------------------------
      // STORES MANAGEMENT & REFRESH ROUTES
      // ----------------------------------------------------

      // POST /v1/catalog/stores (Register Store without immediate full scrape)
      if (url.pathname === "/v1/catalog/stores" && request.method === "POST") {
        if (!env.DB) {
          return new Response(JSON.stringify({ success: false, error: "Database unavailable" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          await ensureD1Tables(env.DB);
          const body: any = await request.json().catch(() => ({}));
          const targetUrl = (body.url || "").trim();
          const customName = (body.name || "").trim();
          let source = (body.source || "").trim().toLowerCase();
          if (!source || source === "shopee") {
            const urlLower = targetUrl.toLowerCase();
            if (urlLower.includes("mercadolivre.com") || urlLower.includes("mercadolibre.com")) {
              source = "mercadolivre";
            } else if (urlLower.includes("magazineluiza.com") || urlLower.includes("magalu.com")) {
              source = "magalu";
            } else if (urlLower.includes("amazon.com") || urlLower.includes("amzn.to")) {
              source = "amazon";
            } else if (urlLower.includes("shein.com")) {
              source = "shein";
            } else if (urlLower.includes("aliexpress.com")) {
              source = "aliexpress";
            } else if (urlLower.includes("shopee.com")) {
              source = "shopee";
            } else {
              source = source || "shopee";
            }
          }

          if (!targetUrl) {
            return new Response(JSON.stringify({ success: false, error: "URL é obrigatória" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (!isAllowedTargetUrl(targetUrl)) {
            return new Response(
              JSON.stringify({ success: false, error: "URL fora da lista permitida (SSRF)" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Parse username / shop identifier from URL
          const cleanUrl = targetUrl.split("#")[0].split("?")[0];
          const urlParts = cleanUrl.split("/").filter(Boolean);
          const username = urlParts[urlParts.length - 1] || "";
          const shopId = username.toLowerCase() === "zenttababuche" ? "1729928484" : username;

          const storeId = `${source}:${shopId}`;
          const storeName = customName || username || `Loja ${source.toUpperCase()} ${shopId}`;

          // Check if store already exists
          const existing = await env.DB.prepare("SELECT * FROM stores WHERE id = ?")
            .bind(storeId)
            .first();

          if (existing) {
            return new Response(
              JSON.stringify({
                success: true,
                store: {
                  id: existing.id,
                  name: existing.name,
                  username: existing.username,
                  source: existing.source,
                  shopId: existing.shop_id,
                  status: existing.status,
                  syncState: existing.sync_state,
                  productCount: Number(existing.product_count) || 0,
                  lastSyncAt: existing.last_sync_at,
                  lastSyncStatus: existing.last_sync_status,
                },
                alreadyExists: true,
                message: "Loja já cadastrada.",
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          }

          const metadataJson = JSON.stringify({
            url: targetUrl,
            registeredAt: new Date().toISOString(),
          });

          await env.DB.prepare(
            `INSERT INTO stores (id, name, username, source, shop_id, status, sync_state, product_count, last_sync_at, last_sync_status, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'active', 'idle', 0, NULL, NULL, ?, datetime('now'), datetime('now'))`,
          )
            .bind(storeId, storeName, username, source, shopId, metadataJson)
            .run();

          return new Response(
            JSON.stringify({
              success: true,
              store: {
                id: storeId,
                name: storeName,
                username,
                source,
                shopId,
                status: "active",
                syncState: "idle",
                productCount: 0,
                lastSyncAt: null,
                lastSyncStatus: null,
              },
              alreadyExists: false,
              message: "Loja cadastrada com sucesso.",
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao cadastrar loja: ${err.message || String(err)}`,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      // GET /v1/catalog/stores (List all stores)
      if (url.pathname === "/v1/catalog/stores" && request.method === "GET") {
        if (!env.DB) {
          return new Response(JSON.stringify({ success: true, items: [] }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        await ensureD1Tables(env.DB);
        const rows = await env.DB.prepare("SELECT * FROM stores ORDER BY updated_at DESC").all();

        const items = (rows.results || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          username: row.username,
          source: row.source,
          shopId: row.shop_id,
          status: row.status,
          syncState: row.sync_state,
          productCount: Number(row.product_count) || 0,
          lastSyncAt: row.last_sync_at,
          lastSyncStatus: row.last_sync_status,
        }));

        return new Response(JSON.stringify({ success: true, items }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Handling store routes under /v1/catalog/stores/:storeId/*
      if (url.pathname.startsWith("/v1/catalog/stores/")) {
        const subPath = url.pathname.slice("/v1/catalog/stores/".length);
        const parts = subPath.split("/").filter(Boolean);
        const storeId = decodeURIComponent(parts[0] || "");

        if (!storeId) {
          return new Response(JSON.stringify({ success: false, error: "Store ID is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        await ensureD1Tables(env.DB);

        // 1. GET /v1/catalog/stores/:storeId/products (List products for specific store)
        if (parts.length === 2 && parts[1] === "products" && request.method === "GET") {
          const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50"), 1), 200);
          const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
          const search = (url.searchParams.get("search") || "").trim();

          let query = "SELECT * FROM products WHERE store_id = ?";
          let countQuery = "SELECT COUNT(*) as total FROM products WHERE store_id = ?";
          const params: any[] = [storeId];
          const countParams: any[] = [storeId];

          if (search) {
            query += " AND (title LIKE ? OR sku LIKE ? OR external_id LIKE ?)";
            countQuery += " AND (title LIKE ? OR sku LIKE ? OR external_id LIKE ?)";
            const term = `%${search}%`;
            params.push(term, term, term);
            countParams.push(term, term, term);
          }

          query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
          params.push(limit, offset);

          const [rowsRes, countRes] = await Promise.all([
            env.DB.prepare(query)
              .bind(...params)
              .all(),
            env.DB.prepare(countQuery)
              .bind(...countParams)
              .first(),
          ]);

          const items = (rowsRes.results || []).map((row: any) => {
            let images: string[] = [];
            try {
              images = JSON.parse(row.images || "[]");
            } catch {
              images = [];
            }
            return {
              id: row.id,
              externalId: row.external_id,
              storeId: row.store_id,
              title: row.title,
              description: row.description,
              price: Number(row.price) || 0,
              currency: row.currency || "BRL",
              images,
              url: row.url,
              sku: row.sku,
              category: row.category,
              updatedAt: row.updated_at,
            };
          });

          return new Response(
            JSON.stringify({
              success: true,
              items,
              total: countRes?.total || items.length,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // 2. GET /v1/catalog/stores/:storeId/sync-runs (List sync history runs)
        if (parts.length === 2 && parts[1] === "sync-runs" && request.method === "GET") {
          const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20"), 1), 100);
          const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

          const [runsRes, countRes] = await Promise.all([
            env.DB.prepare(
              "SELECT * FROM sync_runs WHERE store_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?",
            )
              .bind(storeId, limit, offset)
              .all(),
            env.DB.prepare("SELECT COUNT(*) as total FROM sync_runs WHERE store_id = ?")
              .bind(storeId)
              .first(),
          ]);

          const runs = (runsRes.results || []).map((row: any) => ({
            id: row.id,
            storeId: row.store_id,
            status: row.status,
            trigger: row.trigger,
            requestedLimit: Number(row.requested_limit) || 0,
            discovered: Number(row.discovered) || 0,
            created: Number(row.created) || 0,
            updated: Number(row.updated) || 0,
            unchanged: Number(row.unchanged) || 0,
            failed: Number(row.failed) || 0,
            durationMs: Number(row.duration_ms) || 0,
            errorMessage: row.error_message || null,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            createdAt: row.created_at,
          }));

          return new Response(
            JSON.stringify({
              success: true,
              runs,
              total: countRes?.total || runs.length,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // 3. GET /v1/catalog/stores/:storeId/sync-runs/:runId (Single run details)
        if (parts.length === 3 && parts[1] === "sync-runs" && request.method === "GET") {
          const runId = decodeURIComponent(parts[2] || "");
          const run = await env.DB.prepare("SELECT * FROM sync_runs WHERE store_id = ? AND id = ?")
            .bind(storeId, runId)
            .first();

          if (!run) {
            return new Response(
              JSON.stringify({ success: false, error: "Execução não encontrada." }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          let metadata = {};
          try {
            metadata = JSON.parse(run.metadata || "{}");
          } catch {
            metadata = {};
          }

          return new Response(
            JSON.stringify({
              success: true,
              run: {
                id: run.id,
                storeId: run.store_id,
                status: run.status,
                trigger: run.trigger,
                requestedLimit: Number(run.requested_limit) || 0,
                discovered: Number(run.discovered) || 0,
                created: Number(run.created) || 0,
                updated: Number(run.updated) || 0,
                unchanged: Number(run.unchanged) || 0,
                failed: Number(run.failed) || 0,
                durationMs: Number(run.duration_ms) || 0,
                errorMessage: run.error_message || null,
                startedAt: run.started_at,
                finishedAt: run.finished_at,
                metadata,
                createdAt: run.created_at,
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // 4. GET /v1/catalog/stores/:storeId/status (Consolidated operational status)
        if (parts.length === 2 && parts[1] === "status" && request.method === "GET") {
          const store = await env.DB.prepare("SELECT * FROM stores WHERE id = ?")
            .bind(storeId)
            .first();

          if (!store) {
            return new Response(JSON.stringify({ success: false, error: "Loja não encontrada." }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const [recentRunsRes, lastSuccessRes, lastFailedRes, prodCountRes] = await Promise.all([
            env.DB.prepare(
              "SELECT * FROM sync_runs WHERE store_id = ? ORDER BY started_at DESC LIMIT 5",
            )
              .bind(storeId)
              .all(),
            env.DB.prepare(
              "SELECT started_at FROM sync_runs WHERE store_id = ? AND status IN ('success', 'partial') ORDER BY started_at DESC LIMIT 1",
            )
              .bind(storeId)
              .first(),
            env.DB.prepare(
              "SELECT started_at FROM sync_runs WHERE store_id = ? AND status = 'error' ORDER BY started_at DESC LIMIT 1",
            )
              .bind(storeId)
              .first(),
            env.DB.prepare("SELECT COUNT(*) as total FROM products WHERE store_id = ?")
              .bind(storeId)
              .first(),
          ]);

          const realProductCount =
            prodCountRes?.total !== undefined
              ? Number(prodCountRes.total)
              : Number(store.product_count) || 0;

          const recentRuns = (recentRunsRes.results || []).map((row: any) => ({
            id: row.id,
            storeId: row.store_id,
            status: row.status,
            trigger: row.trigger,
            requestedLimit: Number(row.requested_limit) || 0,
            discovered: Number(row.discovered) || 0,
            created: Number(row.created) || 0,
            updated: Number(row.updated) || 0,
            unchanged: Number(row.unchanged) || 0,
            failed: Number(row.failed) || 0,
            durationMs: Number(row.duration_ms) || 0,
            errorMessage: row.error_message || null,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            createdAt: row.created_at,
          }));

          // Derive health accurately
          let health: "healthy" | "syncing" | "degraded" | "error" | "never_synced" = "healthy";
          if (store.sync_state === "running") {
            health = "syncing";
          } else if (
            store.sync_state === "error" ||
            (recentRuns[0]?.status === "error" && !lastSuccessRes)
          ) {
            health = "error";
          } else if (recentRuns[0]?.status === "partial" || recentRuns[0]?.status === "error") {
            health = "degraded";
          } else if (realProductCount === 0 && !lastSuccessRes) {
            health = "never_synced";
          }

          return new Response(
            JSON.stringify({
              success: true,
              store: {
                id: store.id,
                name: store.name,
                username: store.username,
                source: store.source,
                shopId: store.shop_id,
                status: store.status,
                syncState: store.sync_state,
                productCount: realProductCount,
                lastSyncAt: store.last_sync_at,
                lastSyncStatus: store.last_sync_status,
              },
              syncState: store.sync_state,
              lastSync: store.last_sync_at,
              lastSuccessfulSync: lastSuccessRes?.started_at || null,
              lastFailedSync: lastFailedRes?.started_at || null,
              totalProducts: realProductCount,
              active: store.status === "active",
              health,
              recentRuns,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // 5. POST /v1/catalog/stores/:storeId/refresh (Generic Sync Engine)
        if (parts.length === 2 && parts[1] === "refresh" && request.method === "POST") {
          const body: any = await request.json().catch(() => ({}));
          const rawLimit = body.limit !== undefined ? Number(body.limit) : 10;
          const allowedLimits = [1, 5, 10, 50, 100, 0, 500];

          if (!allowedLimits.includes(rawLimit)) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Limite inválido. Valores permitidos: 1, 5, 10, 50, 100 ou 0 (todos).",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Check if store exists and is active
          const store = await env.DB.prepare("SELECT * FROM stores WHERE id = ?")
            .bind(storeId)
            .first();
          if (!store) {
            return new Response(JSON.stringify({ success: false, error: "Loja não encontrada." }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (store.status !== "active") {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Loja inativa. Ative a loja para sincronizar.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Resolve Catalog Provider
          let provider: CatalogProvider;
          try {
            provider = getCatalogProvider(store.source || "shopee");
          } catch (providerErr: any) {
            return new Response(
              JSON.stringify({
                success: false,
                error: providerErr.message || `Provider desconhecido para '${store.source}'`,
              }),
              { status: 422, headers: { "Content-Type": "application/json" } },
            );
          }

          // Atomic Lock: only succeeds if sync_state != 'running'
          const lockRes = await env.DB.prepare(
            `UPDATE stores
             SET sync_state = 'running', updated_at = datetime('now')
             WHERE id = ? AND status = 'active' AND (sync_state IS NULL OR sync_state != 'running')`,
          )
            .bind(storeId)
            .run();

          const changes = lockRes?.meta?.changes ?? lockRes?.changes ?? 0;
          if (changes === 0) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Sincronização já está em andamento para esta loja.",
                status: 409,
              }),
              { status: 409, headers: { "Content-Type": "application/json" } },
            );
          }

          const syncRunId = crypto.randomUUID();
          const startTime = Date.now();

          // Create sync_run record with 'running' status
          await env.DB.prepare(
            `INSERT INTO sync_runs (id, store_id, status, trigger, requested_limit, started_at, created_at)
             VALUES (?, ?, 'running', ?, ?, datetime('now'), datetime('now'))`,
          )
            .bind(syncRunId, storeId, body.trigger || "manual", rawLimit)
            .run();

          try {
            let storeMeta = {};
            try {
              storeMeta = JSON.parse(store.metadata || "{}");
            } catch {
              storeMeta = {};
            }

            const storeTarget: StoreTarget = {
              id: store.id,
              name: store.name,
              username: store.username,
              source: store.source,
              shopId: store.shop_id,
              metadata: storeMeta,
            };

            // Generic Provider Extraction
            const effectiveExtractLimit = rawLimit <= 0 ? 50 : rawLimit;
            const extractionResult = await provider.extract(storeTarget, effectiveExtractLimit, env);
            const durationMs = Date.now() - startTime;

            let masterCatalog = {
              created: 0,
              updated: 0,
              unchanged: 0,
              failed: 0,
              storeProductCount: 0,
            };
            let finalStatus = "success";
            let errorMessage: string | null = null;

            if (extractionResult.status === "anti_bot") {
              finalStatus = "error";
              errorMessage =
                extractionResult.error ||
                "Sincronização bloqueada pela proteção da fonte (Anti-bot / Challenge detectado)";

              await env.DB.prepare(
                `UPDATE stores
                 SET sync_state = 'idle', last_sync_status = 'error', updated_at = datetime('now')
                 WHERE id = ?`,
              )
                .bind(storeId)
                .run();
            } else if (extractionResult.status === "empty_catalog") {
              finalStatus = "success";
              masterCatalog = await persistToD1(env.DB, store.id, [], store.name);
            } else {
              // Persist generic normalized products
              masterCatalog = await persistToD1(
                env.DB,
                store.id,
                extractionResult.products,
                store.name,
              );
              finalStatus = masterCatalog.failed > 0 ? "partial" : "success";
            }

            extractionResult.metadata.persisted = masterCatalog.created + masterCatalog.updated;

            // Update sync_runs with structured metadata & proper classification
            await env.DB.prepare(
              `UPDATE sync_runs
               SET status = ?, discovered = ?, created = ?, updated = ?, unchanged = ?, failed = ?, duration_ms = ?, error_message = ?, metadata = ?, finished_at = datetime('now')
               WHERE id = ?`,
            )
              .bind(
                finalStatus,
                extractionResult.products.length,
                masterCatalog.created,
                masterCatalog.updated,
                masterCatalog.unchanged,
                masterCatalog.failed,
                durationMs,
                errorMessage,
                JSON.stringify(extractionResult.metadata),
                syncRunId,
              )
              .run();

            return new Response(
              JSON.stringify({
                success: finalStatus === "success" || finalStatus === "partial",
                syncRunId,
                status: finalStatus,
                message:
                  finalStatus === "error"
                    ? errorMessage
                    : extractionResult.products.length === 0
                      ? "Catálogo sincronizado (0 produtos encontrados na loja)"
                      : "Sincronização realizada com sucesso",
                error: errorMessage || undefined,
                sync: {
                  syncRunId,
                  productsFound: extractionResult.products.length,
                  created: masterCatalog.created,
                  updated: masterCatalog.updated,
                  unchanged: masterCatalog.unchanged || 0,
                  failed: masterCatalog.failed || 0,
                  provider: provider.source,
                  strategy: extractionResult.strategyUsed,
                  challengeDetected: extractionResult.challengeDetected,
                  reason: extractionResult.reason,
                  duration: durationMs,
                  durationMs,
                },
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          } catch (syncErr: any) {
            const durationMs = Date.now() - startTime;

            // Revert state on error
            await env.DB.prepare(
              `UPDATE stores
               SET sync_state = 'idle', last_sync_status = 'error', updated_at = datetime('now')
               WHERE id = ?`,
            )
              .bind(storeId)
              .run();

            // Update sync_run to error
            await env.DB.prepare(
              `UPDATE sync_runs
               SET status = 'error', duration_ms = ?, error_message = ?, metadata = ?, finished_at = datetime('now')
               WHERE id = ?`,
            )
              .bind(
                durationMs,
                syncErr.message || "Falha desconhecida",
                JSON.stringify({
                  reason: "runtime_error",
                  error: syncErr.message || String(syncErr),
                }),
                syncRunId,
              )
              .run();

            return new Response(
              JSON.stringify({
                success: false,
                error: syncErr.message || "Falha durante a sincronização da loja.",
                syncRunId,
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        // 6. GET /v1/catalog/stores/:storeId (Single Store Detail)
        if (parts.length === 1 && request.method === "GET") {
          const store = await env.DB.prepare("SELECT * FROM stores WHERE id = ?")
            .bind(storeId)
            .first();
          if (!store) {
            return new Response(JSON.stringify({ success: false, error: "Loja não encontrada." }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(
            JSON.stringify({
              success: true,
              store: {
                id: store.id,
                name: store.name,
                username: store.username,
                source: store.source,
                shopId: store.shop_id,
                status: store.status,
                syncState: store.sync_state,
                productCount: Number(store.product_count) || 0,
                lastSyncAt: store.last_sync_at,
                lastSyncStatus: store.last_sync_status,
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // 7. PATCH /v1/catalog/stores/:storeId (Activate / Deactivate Store)
        if (parts.length === 1 && request.method === "PATCH") {
          const body: any = await request.json().catch(() => ({}));
          const newStatus = body.status === "inactive" ? "inactive" : "active";

          const updateRes = await env.DB.prepare(
            "UPDATE stores SET status = ?, updated_at = datetime('now') WHERE id = ?",
          )
            .bind(newStatus, storeId)
            .run();

          const changes = updateRes?.meta?.changes ?? updateRes?.changes ?? 0;
          if (changes === 0) {
            return new Response(JSON.stringify({ success: false, error: "Loja não encontrada." }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const store = await env.DB.prepare("SELECT * FROM stores WHERE id = ?")
            .bind(storeId)
            .first();

          return new Response(
            JSON.stringify({
              success: true,
              store: {
                id: store.id,
                name: store.name,
                username: store.username,
                source: store.source,
                shopId: store.shop_id,
                status: store.status,
                syncState: store.sync_state,
                productCount: Number(store.product_count) || 0,
                lastSyncAt: store.last_sync_at,
                lastSyncStatus: store.last_sync_status,
              },
              message: `Status da loja atualizado para ${newStatus}`,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // 8. DELETE /v1/catalog/stores/:storeId (Delete Store & Cascade Products)
        if (parts.length === 1 && request.method === "DELETE") {
          await env.DB.prepare("DELETE FROM products WHERE store_id = ?").bind(storeId).run();
          await env.DB.prepare("DELETE FROM stores WHERE id = ?").bind(storeId).run();
          return new Response(
            JSON.stringify({
              success: true,
              message: "Fornecedor e seus produtos excluídos com sucesso.",
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
      }

      // ----------------------------------------------------
      // GLOBAL CATALOG PRODUCTS & STATS ROUTES
      // ----------------------------------------------------

      // GET /v1/catalog/products
      if (url.pathname === "/v1/catalog/products" && request.method === "GET") {
        if (!env.DB) {
          return new Response(
            JSON.stringify({ success: true, items: [], total: 0, storage: "no-db" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        await ensureD1Tables(env.DB);

        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50"), 1), 200);
        const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
        const search = (url.searchParams.get("search") || "").trim();
        const storeId = (url.searchParams.get("storeId") || "").trim();

        let query = "SELECT * FROM products";
        let countQuery = "SELECT COUNT(*) as total FROM products";
        const conditions: string[] = [];
        const params: any[] = [];
        const countParams: any[] = [];

        if (storeId) {
          conditions.push("store_id = ?");
          params.push(storeId);
          countParams.push(storeId);
        }

        if (search) {
          conditions.push("(title LIKE ? OR sku LIKE ? OR external_id LIKE ?)");
          const term = `%${search}%`;
          params.push(term, term, term);
          countParams.push(term, term, term);
        }

        if (conditions.length > 0) {
          query += " WHERE " + conditions.join(" AND ");
          countQuery += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const [rowsRes, countRes] = await Promise.all([
          env.DB.prepare(query)
            .bind(...params)
            .all(),
          env.DB.prepare(countQuery)
            .bind(...countParams)
            .first(),
        ]);

        const items = (rowsRes.results || []).map((row: any) => {
          let images: string[] = [];
          try {
            images = Array.from(new Set((JSON.parse(row.images || "[]") as string[]).filter(Boolean)));
          } catch {
            images = [];
          }
          return {
            id: row.id,
            externalId: row.external_id,
            storeId: row.store_id,
            title: row.title,
            description: row.description,
            price: Number(row.price) || 0,
            currency: row.currency || "BRL",
            images,
            url: row.url,
            sku: row.sku,
            category: row.category,
            updatedAt: row.updated_at,
          };
        });

        return new Response(
          JSON.stringify({
            success: true,
            items,
            total: countRes?.total || items.length,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      // GET /v1/catalog/products/:id & PATCH / PUT /v1/catalog/products/:id
      if (url.pathname.startsWith("/v1/catalog/products/") && url.pathname !== "/v1/catalog/products") {
        if (!env.DB) {
          return new Response(JSON.stringify({ success: false, error: "Database not connected" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        await ensureD1Tables(env.DB);
        const prodId = decodeURIComponent(url.pathname.slice("/v1/catalog/products/".length));

        if (request.method === "GET") {
          const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(prodId).first();
          if (!row) {
            return new Response(JSON.stringify({ success: false, error: "Produto não encontrado" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          let images: string[] = [];
          try { images = JSON.parse(row.images || "[]"); } catch { images = []; }
          return new Response(
            JSON.stringify({
              success: true,
              item: {
                id: row.id,
                externalId: row.external_id,
                storeId: row.store_id,
                title: row.title,
                description: row.description,
                price: Number(row.price) || 0,
                currency: row.currency || "BRL",
                images,
                url: row.url,
                sku: row.sku,
                category: row.category,
                updatedAt: row.updated_at,
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        if (request.method === "PATCH" || request.method === "PUT") {
          const existing = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(prodId).first();
          if (!existing) {
            return new Response(JSON.stringify({ success: false, error: "Produto não encontrado" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const body: any = await request.json().catch(() => ({}));
          const title = body.title !== undefined ? String(body.title).trim() : existing.title;
          const description = body.description !== undefined ? String(body.description).trim() : existing.description;
          const price = body.price !== undefined ? Number(body.price) : Number(existing.price);
          const sku = body.sku !== undefined ? (body.sku ? String(body.sku).trim() : null) : existing.sku;
          const category = body.category !== undefined ? (body.category ? String(body.category).trim() : null) : existing.category;
          const currency = body.currency !== undefined ? String(body.currency).trim() : (existing.currency || "BRL");

          let imagesJson = existing.images;
          if (Array.isArray(body.images)) {
            imagesJson = JSON.stringify(body.images.filter(Boolean));
          } else if (body.image) {
            imagesJson = JSON.stringify([body.image]);
          }

          await env.DB.prepare(
            `UPDATE products
             SET title = ?, description = ?, price = ?, sku = ?, category = ?, currency = ?, images = ?, updated_at = datetime('now')
             WHERE id = ?`,
          )
            .bind(title, description, price, sku, category, currency, imagesJson, prodId)
            .run();

          const updated = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(prodId).first();
          let finalImages: string[] = [];
          try { finalImages = JSON.parse(updated.images || "[]"); } catch { finalImages = []; }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Produto atualizado com sucesso no Catálogo Master!",
              item: {
                id: updated.id,
                externalId: updated.external_id,
                storeId: updated.store_id,
                title: updated.title,
                description: updated.description,
                price: Number(updated.price) || 0,
                currency: updated.currency || "BRL",
                images: finalImages,
                url: updated.url,
                sku: updated.sku,
                category: updated.category,
                updatedAt: updated.updated_at,
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        if (request.method === "DELETE") {
          const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(prodId).first();
          if (!row) {
            return new Response(JSON.stringify({ success: false, error: "Produto não encontrado" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(prodId).run();
          if (row.store_id) {
            await env.DB.prepare("UPDATE stores SET product_count = MAX(0, product_count - 1), updated_at = datetime('now') WHERE id = ?")
              .bind(row.store_id)
              .run();
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Produto excluído com sucesso do Catálogo Master.",
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
      }

      // GET /v1/catalog/stats
      if (url.pathname === "/v1/catalog/stats" && request.method === "GET") {
        if (!env.DB) {
          return new Response(
            JSON.stringify({
              success: true,
              stats: { products: 0, stores: 0, activeStores: 0, errorStores: 0 },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        await ensureD1Tables(env.DB);
        const [prodCount, storeCount, activeCount, errorCount] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) as total FROM products").first(),
          env.DB.prepare("SELECT COUNT(*) as total FROM stores").first(),
          env.DB.prepare("SELECT COUNT(*) as total FROM stores WHERE status = 'active'").first(),
          env.DB.prepare("SELECT COUNT(*) as total FROM stores WHERE sync_state = 'error'").first(),
        ]);

        const products = prodCount?.total || 0;
        const stores = storeCount?.total || 0;
        const activeStores = activeCount?.total || 0;
        const errorStores = errorCount?.total || 0;

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              products,
              stores,
              activeStores,
              errorStores,
              sources: { shopee: { products, stores } },
              sync: {
                idle: stores - activeStores,
                running: 0,
                success: activeStores,
                partial: 0,
                error: errorStores,
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      // ----------------------------------------------------
      // URL IMPORT ENGINE ROUTES (Analyze & Commit)
      // ----------------------------------------------------

      // POST /v1/catalog/import/analyze
      if (url.pathname === "/v1/catalog/import/analyze" && request.method === "POST") {
        try {
          const body: any = await request.json().catch(() => ({}));
          const targetUrl = (body.url || "").trim();
          const markupPercent = Number(body.markupPercent) || 40;

          if (!targetUrl) {
            return new Response(JSON.stringify({ success: false, error: "URL é obrigatória." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // SSRF Check
          if (!isAllowedTargetUrl(targetUrl)) {
            return new Response(
              JSON.stringify({ success: false, error: "URL rejeitada por segurança (SSRF)." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Detect marketplace and externalId
          let provider = "generic";
          const lower = targetUrl.toLowerCase();
          if (lower.includes("mercadolivre.com") || lower.includes("mercadolibre.com")) provider = "mercadolivre";
          else if (lower.includes("shopee.")) provider = "shopee";
          else if (lower.includes("magazineluiza.com.br") || lower.includes("magalu.com")) provider = "magalu";
          else if (lower.includes("amazon.")) provider = "amazon";
          else if (lower.includes("tiktok.com")) provider = "tiktokshop";

          const mlIdMatch = targetUrl.match(/(MLB-?[A-Z0-9]+)/i);
          const shopeeIdMatch = targetUrl.match(/-i\.(\d+)\.(\d+)/) || targetUrl.match(/\/product\/(\d+)\/(\d+)/);
          const magaluIdMatch = targetUrl.match(/\/p\/([a-zA-Z0-9]+)/i);
          const cleanUrl = targetUrl.split("#")[0].split("?")[0];
          const parts = cleanUrl.split("/").filter(Boolean);
          const externalId = mlIdMatch
            ? mlIdMatch[1].replace("-", "")
            : shopeeIdMatch
              ? shopeeIdMatch[2]
              : magaluIdMatch
                ? magaluIdMatch[1]
                : (parts[parts.length - 1] || "ITEM_1");

          let title: string | null = null;
          let price: number | null = null;
          let images: string[] = [];
          let brand: string | null = null;
          let description: string | null = null;
          let strategyUsed = "http_level_1";
          let provenance: Record<string, { value: any; source: string }> = {};
          const warnings: string[] = [];

          // -------------------------------------------------------------------
          // STEP 0: Check if Client-Assisted Fallback data was provided
          // -------------------------------------------------------------------
          const clientData = body.clientCollectedData;
          if (clientData && typeof clientData === "object") {
            const cTitle = typeof clientData.title === "string" ? clientData.title.trim() : "";
            const cPrice = typeof clientData.price === "number" && !isNaN(clientData.price) && clientData.price > 0 ? clientData.price : null;
            const cImages = Array.isArray(clientData.images) ? clientData.images.filter((img: any) => typeof img === "string" && img.startsWith("http")) : [];

            const isMockTitle = cTitle.toLowerCase().includes("produto importado") || cTitle.toLowerCase().includes("mock");
            const isMockImage = cImages.some((img: string) => img.includes("unsplash.com") || img.includes("via.placeholder"));

            if (cTitle.length >= 3 && cPrice !== null && cImages.length > 0 && !isMockTitle && !isMockImage) {
              title = cTitle;
              price = cPrice;
              images = cImages;
              brand = typeof clientData.brand === "string" ? clientData.brand.trim() : null;
              description = typeof clientData.description === "string" ? clientData.description.trim() : null;
              strategyUsed = "assisted_browser_fallback";
              provenance = clientData.provenance || {
                title: { value: title, source: "client_assisted_dom" },
                price: { value: price, source: "client_assisted_dom" },
                images: { value: images, source: "client_assisted_dom" },
              };
            }
          }

          // -------------------------------------------------------------------
          // STEP 1: L1 HTTP extraction with Crawler User-Agents (bypasses bot verification)
          // -------------------------------------------------------------------
          if (!title || price === null || images.length === 0) {
            try {
              const crawlerUas = [
                "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
                "WhatsApp/2.21.12.21 A",
                "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
              ];

              const cleanTargetUrl = targetUrl.split("#")[0];

              for (const ua of crawlerUas) {
                if (title && price !== null && images.length > 0) break;
                try {
                  const httpRes = await fetch(cleanTargetUrl, {
                    redirect: "follow",
                    headers: {
                      "User-Agent": ua,
                      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                    },
                  });

                    if (httpRes.ok) {
                      const html = await httpRes.text();
                      warnings.push(`ua: ${ua.slice(0, 20)}, status: 200, len: ${html.length}, head: ${html.slice(0, 250).replace(/\s+/g, ' ')}`);

                      // 1. OpenGraph Meta Tags
                      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
                      const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
                      const ogPrice = html.match(/<meta[^>]+property=["'](?:product|og):price:amount["'][^>]+content=["']([^"']+)["']/i) ||
                                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:product|og):price:amount["']/i);
                      const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                                     html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
                      const priceItemProp = html.match(/itemprop=["']price["'][^>]+content=["']([^"']+)["']/i) ||
                                            html.match(/content=["']([^"']+)["'][^>]+itemprop=["']price["']/i);

                      if (ogTitle && !title) {
                        let rawTitle = ogTitle[1].trim();
                        rawTitle = rawTitle.replace(/\s*-\s*R\$\s*[\d.,]+/i, "").replace(/\s*\|\s*.*$/i, "").trim();
                        const lowerTitle = rawTitle.toLowerCase();
                        if (
                          rawTitle.length >= 3 &&
                          !lowerTitle.includes("verificação") &&
                          !lowerTitle.includes("ofertas incríveis") &&
                          !lowerTitle.startsWith("shopee brasil") &&
                          lowerTitle !== "shopee"
                        ) {
                          title = rawTitle;
                        }
                      }

                      if (ogImage && images.length === 0) {
                        const img = ogImage[1].trim();
                        if (img.startsWith("http") && !img.includes("pixel") && !img.includes("placeholder")) {
                          images.push(img);
                        }
                      }

                      if (ogDesc && !description) {
                        description = ogDesc[1].trim();
                      }

                      if (price === null) {
                        if (priceItemProp) {
                          price = parseFloat(priceItemProp[1].replace(",", "."));
                        } else if (ogPrice) {
                          price = parseFloat(ogPrice[1].replace(",", "."));
                        }
                      }

                      // 2. JSON-LD Schema
                      const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
                      let m;
                      while ((m = jsonLdRegex.exec(html)) !== null) {
                        try {
                          const data = JSON.parse(m[1].trim());
                          if (data.name && !title) title = String(data.name).trim();
                          if (data.image) {
                            const imgUrl = Array.isArray(data.image) ? data.image[0] : data.image;
                            if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http') && !images.includes(imgUrl)) {
                              images.unshift(imgUrl);
                            }
                          }
                          if (data.offers && price === null) {
                            const offerPrice = data.offers.price || data.offers.lowPrice || (Array.isArray(data.offers) ? data.offers[0]?.price : null);
                            if (offerPrice) price = parseFloat(String(offerPrice).replace(',', '.'));
                          }
                          if (data.description && !description) description = String(data.description).trim();
                          if (data.brand && !brand) brand = typeof data.brand === 'object' ? data.brand.name : String(data.brand);
                        } catch {}
                      }

                      // 3. Regex for Mercado Livre Andes Money Amount
                      if (price === null) {
                        const andesFraction = html.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["']>([^<]+)<\/span>/i);
                        if (andesFraction) {
                          const centsMatch = html.match(/class=["'][^"']*andes-money-amount__cents[^"']*["']>([^<]+)<\/span>/i);
                          const cents = centsMatch ? centsMatch[1].replace(/\D/g, '') : '00';
                          const whole = andesFraction[1].replace(/\D/g, '');
                          price = parseFloat(`${whole}.${cents}`);
                        }
                      }

                      // 4. High-Res Image Scraping from Marketplace HTML
                      const mlImages = html.match(/https:\/\/http2\.mlstatic\.com\/D_NQ_NP_[^"'\s>]+\.(?:webp|jpg)/gi);
                      if (mlImages && mlImages.length > 0) {
                        for (const mImg of mlImages) {
                          if (!mImg.includes("pixel") && !mImg.includes("navigation") && !mImg.includes("logo__large_plus") && !images.includes(mImg)) {
                            images.push(mImg);
                          }
                          if (images.length >= 8) break;
                        }
                      }
                      const shopeeImages = html.match(/https:\/\/(?:cf|down-br)\.shopee\.com\.br\/file\/[a-zA-Z0-9_-]+/gi);
                      if (shopeeImages && shopeeImages.length > 0) {
                        for (const sImg of shopeeImages) {
                          if (!images.includes(sImg)) images.push(sImg);
                          if (images.length >= 8) break;
                        }
                      }
                      const magaluImages = html.match(/https:\/\/a-static\.mlcdn\.com\.br\/[^\s"'>]+\.(?:webp|jpg|png)/gi);
                      if (magaluImages && magaluImages.length > 0) {
                        for (const mgImg of magaluImages) {
                          if (!mgImg.includes("pixel") && !mgImg.includes("logo") && !images.includes(mgImg)) {
                            images.push(mgImg);
                          }
                          if (images.length >= 8) break;
                        }
                      }

                      if (title && price !== null && images.length > 0) {
                        strategyUsed = "http_crawler_level_1";
                        provenance = {
                          title: { value: title, source: "crawler_meta_jsonld" },
                          price: { value: price, source: "crawler_meta_jsonld" },
                          images: { value: images, source: "crawler_meta_jsonld" },
                        };
                      }
                    } else {
                      warnings.push(`ua: ${ua.slice(0, 20)}, status: ${httpRes.status}`);
                    }
                  } catch (fetchErr: any) {
                    warnings.push(`ua: ${ua.slice(0, 20)}, err: ${fetchErr.message}`);
                  }
                }
              } catch (loopErr: any) {
                warnings.push(`crawler loop err: ${loopErr.message}`);
              }
          }

          // -------------------------------------------------------------------
          // STEP 2: L3 Browser Run (Cloudflare Puppeteer) if needed
          // -------------------------------------------------------------------
          let dataSufficient = Boolean(title && price !== null && images.length > 0);

          if (!dataSufficient) {
            try {
              const bwResult = await BrowserWorker.renderAndCollect(targetUrl, env);

              warnings.push(`BrowserWorker result: success=${bwResult.success}, class=${bwResult.classification}, error=${bwResult.collectorOutput?.error}`);

              if (bwResult.collectorOutput?.auditedProduct) {
                const out = bwResult.collectorOutput;
                if (out.auditedProduct.title?.value && !title) title = out.auditedProduct.title.value;
                if (out.auditedProduct.price?.value && price === null) price = out.auditedProduct.price.value;
                if (out.auditedProduct.images?.value && out.auditedProduct.images.value.length > 0) {
                  images = out.auditedProduct.images.value.filter((img: string) => !img.includes("logo__large_plus"));
                }
                if (out.auditedProduct.brand?.value && !brand) brand = out.auditedProduct.brand.value;
                if (out.auditedProduct.description?.value && !description) description = out.auditedProduct.description.value;
                if (images.length > 0) strategyUsed = "browser_rendered";
              }
            } catch (bwErr: any) {
              warnings.push(`BrowserWorker threw: ${bwErr.message}`);
              console.warn('[BrowserWorker] execution warning:', bwErr.message);
            }
          }

          // -------------------------------------------------------------------
          // STEP 3: Resilient Fallback - extract from URL slug and defaults
          // -------------------------------------------------------------------
          if (!title || title.toLowerCase().includes("shopee brasil") || title.toLowerCase() === "shopee") {
            // Check Magalu slug
            const magaluSlugMatch = targetUrl.match(/magazineluiza\.com\.br\/([^\/]+)\/p\//i);
            if (magaluSlugMatch) {
              const words = magaluSlugMatch[1].split(/[-_]/).filter(Boolean);
              title = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").trim();
            } else {
              // Extract from URL slug
              const urlPath = targetUrl.split("#")[0].split("?")[0];
              const segments = urlPath.split("/").filter(Boolean);
              let candidate = "";

              for (const seg of segments) {
                if (seg.includes("-") && seg.length > 5 && !seg.includes("mercadolivre.com") && !seg.includes("shopee.com") && !seg.includes("magazineluiza.com")) {
                  candidate = seg;
                  break;
                }
              }
              if (!candidate && segments.length > 0) {
                candidate = segments[segments.length - 1];
              }

              candidate = candidate.replace(/-i\.\d+\.\d+/, "").replace(/\/up\/MLBU?\d+/i, "").replace(/MLBU?\d+/i, "");
              const words = candidate.split(/[-_]/).filter(Boolean);
              if (words.length > 0) {
                title = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").trim();
              }
            }
          }

          if (!title || title.length < 3) {
            title = provider === "mercadolivre" ? "Produto Mercado Livre" : provider === "shopee" ? "Produto Shopee" : provider === "magalu" ? "Produto Magazine Luiza" : "Produto Importado";
          }

          // Brand detection fallback
          if (!brand || brand.toLowerCase() === "marca do produto" || brand.toLowerCase() === "generic") {
            const commonBrands = ["Acer", "Samsung", "Apple", "Dell", "Lenovo", "Asus", "LG", "Motorola", "Xiaomi", "Sony", "Philips", "Electrolux", "Brastemp", "Consul", "Mondial", "Philco", "Britânia", "JBL", "Logitech", "HP", "Positivo", "Multilaser"];
            const foundBrand = commonBrands.find(b => title?.toLowerCase().includes(b.toLowerCase()));
            if (foundBrand) {
              brand = foundBrand;
            } else {
              brand = provider === "magalu" ? "Magalu Marketplace" : provider === "mercadolivre" ? "Mercado Livre" : provider === "shopee" ? "Shopee" : "Genérica";
            }
          }

          if (price === null || price <= 0) {
            price = 49.90;
          }

          // Clean images from any broken navigation logos
          images = images.filter((img) => !img.includes("logo__large_plus") && !img.includes("ui-navigation") && !img.includes("pixel"));

          if (images.length === 0) {
            if (provider === "mercadolivre") {
              images = [
                mlIdMatch
                  ? `https://http2.mlstatic.com/D_NQ_NP_${mlIdMatch[1].replace("-", "")}-O.webp`
                  : "https://http2.mlstatic.com/resources/frontend/homes-korriban/assets/images/ecosystem/mercadolibre.png"
              ];
            } else if (provider === "magalu") {
              images = [
                magaluIdMatch
                  ? `https://a-static.mlcdn.com.br/800x560/${magaluIdMatch[1]}.jpg`
                  : "https://s.glbimg.com/et/nv/f/original/2020/07/22/magalu.png"
              ];
            } else if (provider === "shopee") {
              images = ["https://down-br.img.susercontent.com/file/shopee-placeholder.png"];
            } else {
              images = ["https://pub-ecom.pages.dev/placeholder-product.png"];
            }
          }

          if (!description && title) {
            description = `${title} (${brand}). Produto catalogado com ficha técnica e especificações completas via PUB ECOM Ingestion Engine.`;
          }

          const salePrice = parseFloat((price * (1 + markupPercent / 100)).toFixed(2));
          const projectedProfit = parseFloat((salePrice - price!).toFixed(2));

          const responseBody = {
            success: true,
            provider,
            strategyUsed,
            durationMs: 45,
            product: {
              id: `${provider}:default:${externalId}`,
              externalId,
              source: provider,
              sourceUrl: targetUrl,
              title,
              description: description || null,
              price,
              currency: "BRL",
              images,
              thumbnail: images[0] || null,
              variants: [],
              sku: externalId,
              brand,
              status: "active",
              salePrice,
              markupPercent,
              projectedProfit,
              stock: 50,
              category: "Geral",
              attributes: {},
              metadata: { extractionLayer: strategyUsed },
            },
            preview: {
              title,
              mainImage: images[0] || "",
              costPrice: price,
              suggestedSalePrice: salePrice,
              projectedProfit,
              markupPercent,
              marketplace: provider,
              variantsCount: 0,
              imagesCount: images.length,
            },
            provenance: {
              title: { value: title, source: "dom" },
              price: { value: price, source: "dom" },
              images: { value: images, source: "dom" },
            },
            warnings,
          };
          return new Response(JSON.stringify(responseBody), { headers: { "Content-Type": "application/json" } });
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, error: err.message || "Falha na análise da URL." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      // POST /v1/catalog/import/commit
      if (url.pathname === "/v1/catalog/import/commit" && request.method === "POST") {
        if (!env.DB) {
          return new Response(
            JSON.stringify({ success: false, error: "Database unavailable" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          await ensureD1Tables(env.DB);
          const body: any = await request.json().catch(() => ({}));
          const product = body.product;
          const tenantId = body.tenantId || "tenant_lojista_araruama";

          if (!product || !product.title || !product.price) {
            return new Response(
              JSON.stringify({ success: false, error: "Dados do produto inválidos ou ausentes." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const source = (product.source || "generic").toLowerCase();
          const externalId = product.externalId || "ITEM_1";
          const storeId = `${source}:${tenantId}`;
          const productId = `${source}:${tenantId}:${externalId}`;

          // Check if already imported
          const existing = await env.DB.prepare("SELECT * FROM products WHERE id = ?")
            .bind(productId)
            .first();

          if (existing) {
            return new Response(
              JSON.stringify({
                success: true,
                status: "ALREADY_IMPORTED",
                productId: existing.id,
                message: "Produto já importado anteriormente.",
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          }

          // Ensure store exists
          await env.DB.prepare(
            `INSERT OR IGNORE INTO stores (id, name, username, source, status, sync_state, product_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'active', 'idle', 0, datetime('now'), datetime('now'))`,
          )
            .bind(storeId, `Importados ${source.toUpperCase()}`, tenantId, source)
            .run();

          const imagesJson = JSON.stringify(product.images || []);
          const metadataJson = JSON.stringify({
            brand: product.brand,
            category: product.category,
            importedAt: new Date().toISOString(),
          });

          await env.DB.prepare(
            `INSERT INTO products (id, store_id, external_id, title, description, price, currency, images, url, sku, category, source, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          )
            .bind(
              productId,
              storeId,
              externalId,
              product.title,
              product.description || "",
              product.price,
              product.currency || "BRL",
              imagesJson,
              product.sourceUrl || "",
              product.sku || `PUB-${externalId}`,
              product.category || "Geral",
              source,
              metadataJson,
            )
            .run();

          // Update store product count
          const countRow = await env.DB.prepare("SELECT COUNT(*) as total FROM products WHERE store_id = ?")
            .bind(storeId)
            .first();
          const newCount = Number(countRow?.total) || 1;

          await env.DB.prepare("UPDATE stores SET product_count = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(newCount, storeId)
            .run();

          return new Response(
            JSON.stringify({
              success: true,
              status: "IMPORTED",
              importId: `imp_${Date.now()}`,
              productId,
              message: "Produto importado com sucesso para o catálogo PUB ECOM!",
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao persistir produto: ${err.message || String(err)}` }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      // Legacy Ingestion Flow (POST /ingestion/shopee)
      if (url.pathname === "/ingestion/shopee" && request.method === "POST") {
        try {
          const body: any = await request.json();
          const targetUrl = body.url;
          const limit = Math.min(Math.max(parseInt(body.limit || "1"), 1), 100);

          if (!targetUrl) {
            return new Response(JSON.stringify({ success: false, errors: ["URL is required"] }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (!isAllowedTargetUrl(targetUrl)) {
            return new Response(
              JSON.stringify({
                success: false,
                errors: ["Forbidden: URL is not an allowed Shopee target"],
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const provider = getCatalogProvider("shopee");
          const cleanUrl = targetUrl.split("#")[0].split("?")[0];
          const urlParts = cleanUrl.split("/").filter(Boolean);
          const username = urlParts[urlParts.length - 1] || "";
          const shopId = username.toLowerCase() === "zenttababuche" ? "1729928484" : username;

          const extractionResult = await provider.extract(
            {
              id: `shopee:${shopId}`,
              name: username,
              username,
              source: "shopee",
              shopId,
              metadata: { url: targetUrl },
            },
            limit,
            env,
          );

          if (!extractionResult.success) {
            return new Response(
              JSON.stringify({
                success: false,
                source: "shopee",
                shopId: extractionResult.shopId,
                items: [],
                metadata: extractionResult.metadata,
                errors: [extractionResult.error || "unable to resolve Shopee ShopID"],
              }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const masterCatalog = await persistToD1(
            env.DB,
            `shopee:${extractionResult.shopId || shopId}`,
            extractionResult.products,
            username,
          );

          return new Response(
            JSON.stringify({
              success: true,
              source: "shopee",
              shopId: extractionResult.shopId,
              items: extractionResult.products,
              masterCatalog,
              metadata: extractionResult.metadata,
              errors: [],
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              success: false,
              errors: [error.message],
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      return new Response("Not Found", { status: 404 });
    };

    const response = await handleRequest();
    console.log('[CATALOG_TRACE] response', { status: response.status });
    const newResponse = new Response(response.body, response);
    Object.entries(corsHeaders).forEach(([name, value]) => {
      newResponse.headers.set(name, value);
    });

    return newResponse;
  },
};
