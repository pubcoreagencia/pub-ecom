import { describe, it, expect, vi } from "vitest";

// Mock chromium and launch from @cloudflare/playwright
vi.mock("@cloudflare/playwright", () => ({
  launch: vi.fn(),
  chromium: {
    launch: vi.fn(),
    sessions: vi.fn(),
    history: vi.fn(),
    limits: vi.fn(),
  },
}));

import worker from "./index";

const env = {
  BROWSER: {},
  CATALOG_WORKER_TOKEN: "test-token",
};

describe("Catalog Worker CORS", () => {
  it("should handle preflight OPTIONS request", async () => {
    const req = new Request("http://localhost/ingestion/shopee", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:8080",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization, Content-Type",
      },
    });

    const resp = await worker.fetch(req, env as any);
    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8080");
    expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("should add CORS to unauthorized responses", async () => {
    const req = new Request("http://localhost/ingestion/shopee", {
      method: "POST",
      headers: {
        Origin: "http://localhost:8080",
        Authorization: "Bearer wrong-token",
      },
    });

    const resp = await worker.fetch(req, env as any);
    expect(resp.status).toBe(401);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8080");
  });

  it("should not allow unauthorized origins", async () => {
    const req = new Request("http://localhost/health", {
      method: "GET",
      headers: {
        Origin: "https://malicious.com",
      },
    });

    const resp = await worker.fetch(req, env as any);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("should allow Cloudflare Pages and Workers preview origins", async () => {
    const req = new Request("http://localhost/health", {
      method: "GET",
      headers: {
        Origin: "https://pubcoreagencia-pubecomhub.pages.dev",
      },
    });

    const resp = await worker.fetch(req, env as any);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://pubcoreagencia-pubecomhub.pages.dev",
    );
  });

  it("should return catalog products from D1 when authorized", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "shopee:1729928484:1001",
                external_id: "1001",
                store_id: "shopee:1729928484",
                title: "Sandalia Babuche Infantil",
                price: 29.9,
                currency: "BRL",
                images: JSON.stringify(["https://cf.shopee.com.br/file/img1.jpg"]),
                url: "https://shopee.com.br/product/1729928484/1001",
                sku: "SKU-1001",
                category: "Calçados",
                updated_at: "2026-08-24T12:00:00Z",
              },
            ],
          }),
          first: vi.fn().mockResolvedValue({ total: 1 }),
        }),
      }),
    };

    const req = new Request("http://localhost/v1/catalog/products?limit=10", {
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(200);
    const json: any = await resp.json();
    expect(json.success).toBe(true);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].title).toBe("Sandalia Babuche Infantil");
    expect(json.items[0].images).toEqual(["https://cf.shopee.com.br/file/img1.jpg"]);
  });

  it("should list stores from D1 via GET /v1/catalog/stores", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: "shopee:1729928484",
              name: "Zentta Babuche",
              username: "zenttababuche",
              source: "shopee",
              shop_id: "1729928484",
              status: "active",
              sync_state: "success",
              product_count: 10,
              last_sync_at: "2026-08-24T12:00:00Z",
              last_sync_status: "success",
            },
          ],
        }),
      }),
    };

    const req = new Request("http://localhost/v1/catalog/stores", {
      method: "GET",
      headers: { Authorization: "Bearer test-token" },
    });

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(200);
    const json: any = await resp.json();
    expect(json.success).toBe(true);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].name).toBe("Zentta Babuche");
  });

  it("should reject refresh when limit is invalid (not 1, 10, 50, 100)", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn(),
    };

    const req = new Request("http://localhost/v1/catalog/stores/shopee:1729928484/refresh", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 25 }), // invalid limit
    });

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(400);
    const json: any = await resp.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Limite inválido");
  });

  it("should return 409 Conflict when a refresh is already running on that store", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes("SELECT * FROM stores")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: "shopee:1729928484",
                status: "active",
                sync_state: "running",
              }),
            }),
          };
        }
        if (query.includes("UPDATE stores SET sync_state = 'running'")) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({
                meta: { changes: 0 }, // atomic lock failed because already running
              }),
            }),
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({}),
          }),
        };
      }),
    };

    const req = new Request("http://localhost/v1/catalog/stores/shopee:1729928484/refresh", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 10 }),
    });

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(409);
    const json: any = await resp.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Sincronização já está em andamento");
  });

  it("should update store status via PATCH /v1/catalog/stores/:storeId", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes("UPDATE stores SET status")) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
            }),
          };
        }
        if (query.includes("SELECT * FROM stores WHERE id")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: "shopee:1729928484",
                name: "Zentta Babuche",
                status: "inactive",
                sync_state: "idle",
                product_count: 10,
              }),
            }),
          };
        }
        return { bind: vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({}) }) };
      }),
    };

    const req = new Request("http://localhost/v1/catalog/stores/shopee:1729928484", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "inactive" }),
    });

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(200);
    const json: any = await resp.json();
    expect(json.success).toBe(true);
    expect(json.store.status).toBe("inactive");
  });

  it("should list sync runs via GET /v1/catalog/stores/:storeId/sync-runs", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "run-123",
                store_id: "shopee:1729928484",
                status: "success",
                trigger: "manual",
                requested_limit: 10,
                discovered: 10,
                created: 10,
                updated: 0,
                unchanged: 0,
                failed: 0,
                duration_ms: 1200,
                started_at: "2026-08-24T12:00:00Z",
                finished_at: "2026-08-24T12:00:01Z",
                created_at: "2026-08-24T12:00:00Z",
              },
            ],
          }),
          first: vi.fn().mockResolvedValue({ total: 1 }),
        }),
      }),
    };

    const req = new Request(
      "http://localhost/v1/catalog/stores/shopee:1729928484/sync-runs?limit=10&status=success",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
      },
    );

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(200);
    const json: any = await resp.json();
    expect(json.success).toBe(true);
    expect(json.runs).toHaveLength(1);
    expect(json.runs[0].id).toBe("run-123");
    expect(json.runs[0].status).toBe("success");
    expect(json.total).toBe(1);
  });

  it("should return single sync run via GET /v1/catalog/stores/:storeId/sync-runs/:runId", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: "run-123",
            store_id: "shopee:1729928484",
            status: "success",
            trigger: "manual",
            requested_limit: 10,
            discovered: 10,
            created: 10,
            updated: 0,
            unchanged: 0,
            failed: 0,
            duration_ms: 1200,
            started_at: "2026-08-24T12:00:00Z",
            finished_at: "2026-08-24T12:00:01Z",
            created_at: "2026-08-24T12:00:00Z",
          }),
        }),
      }),
    };

    const req = new Request(
      "http://localhost/v1/catalog/stores/shopee:1729928484/sync-runs/run-123",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
      },
    );

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(200);
    const json: any = await resp.json();
    expect(json.success).toBe(true);
    expect(json.run.id).toBe("run-123");
  });

  it("should return 404 for non-existent sync run", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    };

    const req = new Request(
      "http://localhost/v1/catalog/stores/shopee:1729928484/sync-runs/run-nonexistent",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
      },
    );

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(404);
    const json: any = await resp.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Execução não encontrada");
  });

  it("should return consolidated operational status via GET /v1/catalog/stores/:storeId/status", async () => {
    const mockDb = {
      exec: vi.fn().mockResolvedValue({}),
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes("SELECT * FROM stores WHERE id")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: "shopee:1729928484",
                name: "Zentta Babuche",
                username: "zenttababuche",
                source: "shopee",
                shop_id: "1729928484",
                status: "active",
                sync_state: "success",
                product_count: 10,
                last_sync_at: "2026-08-24T12:00:00Z",
                last_sync_status: "success",
              }),
            }),
          };
        }
        if (query.includes("SELECT * FROM sync_runs WHERE store_id")) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: "run-123",
                    store_id: "shopee:1729928484",
                    status: "success",
                    trigger: "manual",
                    requested_limit: 10,
                    discovered: 10,
                    created: 10,
                    updated: 0,
                    unchanged: 0,
                    failed: 0,
                    duration_ms: 1200,
                    started_at: "2026-08-24T12:00:00Z",
                    finished_at: "2026-08-24T12:00:01Z",
                    created_at: "2026-08-24T12:00:00Z",
                  },
                ],
              }),
            }),
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ started_at: "2026-08-24T12:00:00Z" }),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        };
      }),
    };

    const req = new Request("http://localhost/v1/catalog/stores/shopee:1729928484/status", {
      method: "GET",
      headers: { Authorization: "Bearer test-token" },
    });

    const resp = await worker.fetch(req, { ...env, DB: mockDb } as any);
    expect(resp.status).toBe(200);
    const json: any = await resp.json();
    expect(json.success).toBe(true);
    expect(json.health).toBe("healthy");
    expect(json.totalProducts).toBe(10);
    expect(json.active).toBe(true);
    expect(json.recentRuns).toHaveLength(1);
  });
});
