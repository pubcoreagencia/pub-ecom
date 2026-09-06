import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCatalogProxy } from "../src/server/catalogProxy";

describe("Catalog Proxy Authentication & RBAC Forensics (HTTP real)", () => {
  const MASTER_TOKEN = "mock-jwt-master-token";
  const LOJISTA_TOKEN = "mock-jwt-lojista-token";
  const FORNECEDOR_TOKEN = "mock-jwt-fornecedor-token";
  const INFLUENCER_TOKEN = "mock-jwt-influencer-token";
  const INVALID_TOKEN = "mock-jwt-invalid-token";

  const mockEnv = {
    SUPABASE_URL: "https://test-project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    CATALOG_WORKER_URL: "https://pub-ecom-catalog-worker.contato-pubcore.workers.dev",
    CATALOG_WORKER_TOKEN: "valid-worker-token-12345",
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock global fetch for upstream worker and Supabase calls
    global.fetch = vi.fn(async (input: any, init?: any) => {
      const urlStr = String(typeof input === "string" ? input : input.url || "");

      // Supabase Auth getUser mock
      if (urlStr.includes("/auth/v1/user")) {
        const authHeader = init?.headers?.Authorization || init?.headers?.get?.("Authorization");
        if (authHeader?.includes(MASTER_TOKEN)) {
          return new Response(JSON.stringify({ id: "uid-master", email: "admin@pub.com" }), {
            status: 200,
          });
        }
        if (authHeader?.includes(LOJISTA_TOKEN)) {
          return new Response(JSON.stringify({ id: "uid-lojista", email: "lojista@pub.com" }), {
            status: 200,
          });
        }
        if (authHeader?.includes(FORNECEDOR_TOKEN)) {
          return new Response(JSON.stringify({ id: "uid-fornecedor", email: "forn@pub.com" }), {
            status: 200,
          });
        }
        if (authHeader?.includes(INFLUENCER_TOKEN)) {
          return new Response(JSON.stringify({ id: "uid-influencer", email: "inf@pub.com" }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ message: "Invalid JWT" }), { status: 401 });
      }

      // Supabase Profiles query mock
      if (urlStr.includes("/rest/v1/profiles")) {
        if (urlStr.includes("uid-master")) {
          return new Response(JSON.stringify([{ role: "MASTER" }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (urlStr.includes("uid-lojista")) {
          return new Response(JSON.stringify([{ role: "LOJISTA" }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (urlStr.includes("uid-fornecedor")) {
          return new Response(JSON.stringify([{ role: "FORNECEDOR" }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (urlStr.includes("uid-influencer")) {
          return new Response(JSON.stringify([{ role: "INFLUENCER" }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      // Supabase Stores query mock
      if (urlStr.includes("/rest/v1/stores")) {
        if (urlStr.includes("store-a")) {
          return new Response(JSON.stringify([{ id: "store-a", owner_id: "uid-lojista" }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (urlStr.includes("store-b")) {
          return new Response(JSON.stringify([{ id: "store-b", owner_id: "uid-other-user" }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      // Upstream Catalog Worker mock
      if (urlStr.includes("pub-ecom-catalog-worker.contato-pubcore.workers.dev")) {
        const auth = init?.headers?.get?.("authorization") || init?.headers?.authorization;
        if (auth === "Bearer valid-worker-token-12345") {
          return new Response(
            JSON.stringify({
              success: true,
              message: "Proxied successfully",
              items: [{ id: "1" }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized worker token" }),
          { status: 401 },
        );
      }

      return new Response("Not found", { status: 404 });
    });
  });

  describe("1. Unauthenticated Proxy Prevention (1 & 2)", () => {
    it("1. Sem Authorization: requisição sem token retorna 401 Unauthorized", async () => {
      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopId: "12345" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(401);
      const json = await res!.json();
      expect(json.isAuthError).toBe(true);
      expect(json.error).toContain("Unauthorized");
    });

    it("2. JWT inválido: requisição com JWT inválido retorna 401 Unauthorized", async () => {
      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${INVALID_TOKEN}`,
        },
        body: JSON.stringify({ shopId: "12345" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(401);
    });
  });

  describe("2. Role-Based Scraping Authorization (3 & 4)", () => {
    it("3. Usuário autenticado não-MASTER (LOJISTA) é rejeitado com 403 Forbidden em /ingestion/shopee", async () => {
      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${LOJISTA_TOKEN}`,
        },
        body: JSON.stringify({ shopId: "12345" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
      const json = await res!.json();
      expect(json.requiredRole).toBe("MASTER");
      expect(json.currentRole).toBe("LOJISTA");
    });

    it("3. Usuário autenticado FORNECEDOR é rejeitado com 403 Forbidden em /ingestion/shopee", async () => {
      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${FORNECEDOR_TOKEN}`,
        },
        body: JSON.stringify({ shopId: "12345" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    });

    it("3. Usuário autenticado INFLUENCER é rejeitado com 403 Forbidden em /ingestion/shopee", async () => {
      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${INFLUENCER_TOKEN}`,
        },
        body: JSON.stringify({ shopId: "12345" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    });

    it("4. MASTER + Worker token configurado: encaminha ao Worker e retorna 200", async () => {
      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${MASTER_TOKEN}`,
        },
        body: JSON.stringify({ shopId: "12345" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);
      const json = await res!.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe("Proxied successfully");
    });
  });

  describe("3. Upstream Status and Error Propagation (5, 6, 7, 8, 9, 10)", () => {
    it("5. Worker retorna 200/202: Hub repassa status e body intactos", async () => {
      const req = new Request("https://pubecomhub.com/api/catalog/stats", {
        method: "GET",
        headers: { authorization: `Bearer ${MASTER_TOKEN}` },
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);
    });

    it("6. Worker retorna 400: Hub repassa erro 400 adequadamente", async () => {
      // Override fetch for this test
      const customFetch = vi.fn(async (input: any, init?: any) => {
        const urlStr = String(typeof input === "string" ? input : input.url || "");
        if (urlStr.includes("/auth/v1/user")) {
          return new Response(JSON.stringify({ id: "uid-master" }), { status: 200 });
        }
        if (urlStr.includes("/rest/v1/profiles")) {
          return new Response(JSON.stringify([{ role: "MASTER" }]), { status: 200 });
        }
        if (urlStr.includes("pub-ecom-catalog-worker")) {
          return new Response(JSON.stringify({ error: "Unsupported or unsafe URL" }), {
            status: 400,
          });
        }
        return new Response("Not found", { status: 404 });
      });
      global.fetch = customFetch;

      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${MASTER_TOKEN}`,
        },
        body: JSON.stringify({ url: "https://invalid-host.com" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(400);
      const json = await res!.json();
      expect(json.error).toBe("Unsupported or unsafe URL");
    });

    it("7. Worker retorna 401/403: Hub não transforma em sucesso e preserva status", async () => {
      const customFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr.includes("/auth/v1/user"))
          return new Response(JSON.stringify({ id: "uid-master" }), { status: 200 });
        if (urlStr.includes("/rest/v1/profiles"))
          return new Response(JSON.stringify([{ role: "MASTER" }]), { status: 200 });
        if (urlStr.includes("pub-ecom-catalog-worker"))
          return new Response(JSON.stringify({ error: "Unauthorized upstream" }), { status: 401 });
        return new Response("Not found", { status: 404 });
      });
      global.fetch = customFetch;

      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: { authorization: `Bearer ${MASTER_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://shopee.com.br/shop" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(401);
    });

    it("8. Worker indisponível: Hub retorna HTTP 502 Bad Gateway com mensagem clara", async () => {
      const customFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr.includes("/auth/v1/user"))
          return new Response(JSON.stringify({ id: "uid-master" }), { status: 200 });
        if (urlStr.includes("/rest/v1/profiles"))
          return new Response(JSON.stringify([{ role: "MASTER" }]), { status: 200 });
        if (urlStr.includes("pub-ecom-catalog-worker"))
          throw new Error("Worker network timeout / connection refused");
        return new Response("Not found", { status: 404 });
      });
      global.fetch = customFetch;

      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: { authorization: `Bearer ${MASTER_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://shopee.com.br/shop" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(502);
      const json = await res!.json();
      expect(json.error).toContain("Falha ao conectar com Catalog Worker");
    });

    it("9. CATALOG_WORKER_TOKEN ausente: Hub retorna 500 com mensagem clara sem travar", async () => {
      const envWithoutToken = {
        ...mockEnv,
        CATALOG_WORKER_TOKEN: "",
        VITE_CATALOG_API_TOKEN: "",
      };

      const req = new Request("https://pubecomhub.com/v1/catalog/stores", {
        method: "GET",
        headers: { authorization: `Bearer ${MASTER_TOKEN}` },
      });

      const res = await handleCatalogProxy(req, envWithoutToken);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(500);
      const json = await res!.json();
      expect(json.error).toContain("CATALOG_WORKER_TOKEN não configurado no servidor");
    });

    it("10. Resposta do proxy NUNCA vaza CATALOG_WORKER_TOKEN", async () => {
      const req = new Request("https://pubecomhub.com/ingestion/shopee", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${MASTER_TOKEN}`,
        },
        body: JSON.stringify({ shopId: "12345" }),
      });

      const res = await handleCatalogProxy(req, mockEnv);
      const bodyText = await res!.clone().text();
      expect(bodyText).not.toContain("valid-worker-token-12345");
      expect(res!.headers.get("authorization")).toBeNull();
    });
  });

  describe("4. Store Refresh Tenant Isolation", () => {
    it("LOJISTA proprietário da Loja A tem permissão (HTTP 200) para atualizar Loja A", async () => {
      const req = new Request("https://pubecomhub.com/v1/catalog/stores/store-a/refresh", {
        method: "POST",
        headers: { authorization: `Bearer ${LOJISTA_TOKEN}` },
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);
    });

    it("LOJISTA não-proprietário da Loja B é bloqueado com 403 Forbidden", async () => {
      const req = new Request("https://pubecomhub.com/v1/catalog/stores/store-b/refresh", {
        method: "POST",
        headers: { authorization: `Bearer ${LOJISTA_TOKEN}` },
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    });

    it("MASTER tem permissão global (HTTP 200) para atualizar qualquer loja", async () => {
      const req = new Request("https://pubecomhub.com/v1/catalog/stores/store-b/refresh", {
        method: "POST",
        headers: { authorization: `Bearer ${MASTER_TOKEN}` },
      });

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);
    });
  });

  describe("5. CORS & Standalone Origin Dynamic Allowlist", () => {
    it("responde 204 com headers CORS para preflight OPTIONS vindo de localhost", async () => {
      const req = new Request(
        "https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev/api/ingestion/shopee",
        {
          method: "OPTIONS",
          headers: {
            Origin: "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, content-type",
          },
        },
      );

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(204);
      expect(res!.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
      expect(res!.headers.get("access-control-allow-credentials")).toBe("true");
    });

    it("responde 204 com headers CORS para preflight OPTIONS vindo de domínio .workers.dev / .pages.dev", async () => {
      const req = new Request(
        "https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev/api/ingestion/shopee",
        {
          method: "OPTIONS",
          headers: {
            Origin: "https://pubcoreagencia-pubecomhub.pages.dev",
          },
        },
      );

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(204);
      expect(res!.headers.get("access-control-allow-origin")).toBe(
        "https://pubcoreagencia-pubecomhub.pages.dev",
      );
    });

    it("injeta headers CORS na resposta de ingestão para origem autorizada", async () => {
      const req = new Request(
        "https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev/api/ingestion/shopee",
        {
          method: "POST",
          headers: {
            Origin: "https://pubecomhub.com",
            authorization: `Bearer ${MASTER_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ url: "https://shopee.com.br/shop/1729928484", limit: 3 }),
        },
      );

      const res = await handleCatalogProxy(req, mockEnv);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);
      expect(res!.headers.get("access-control-allow-origin")).toBe("https://pubecomhub.com");
      expect(res!.headers.get("access-control-allow-credentials")).toBe("true");
    });
  });
});
