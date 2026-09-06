import { describe, it, expect, vi } from "vitest";
import { isAllowedTargetUrl, validateTargetUrl } from "../src/lib/ingestion/security/urlValidator";
import { ShopeeAdapter } from "../src/lib/ingestion/adapters/ShopeeAdapter";
import { handleCatalogProxy } from "../src/server/catalogProxy";

describe("TAREFA 11 - Teste E2E da Ingestao Shopee (ddmaquinas)", () => {
  const targetUrl = "https://shopee.com.br/ddmaquinas";
  const MASTER_TOKEN = "mock-jwt-master-token";

  it("valida que https://shopee.com.br/ddmaquinas e permitida pelo validador SSRF", () => {
    expect(isAllowedTargetUrl(targetUrl)).toBe(true);
    expect(() => validateTargetUrl(targetUrl)).not.toThrow();
  });

  it("valida que o ShopeeAdapter reconhece a URL como valida para descoberta", () => {
    const adapter = new ShopeeAdapter();
    expect(adapter.canHandle(targetUrl)).toBe(true);
  });

  it("valida o roteamento do Catalog Proxy para o Catalog Worker para ddmaquinas", async () => {
    let capturedUpstreamRequest: Request | null = null;
    const mockWorkerResponse = {
      success: true,
      shopId: "1729928484",
      itemsCount: 2,
      data: [
        {
          itemid: 10001,
          shopid: 1729928484,
          name: "Furadeira de Impacto Profissional",
          price: 29900000,
          currency: "BRL",
          stock: 50,
          images: ["https://cf.shopee.com.br/file/img1.jpg"],
        },
        {
          itemid: 10002,
          shopid: 1729928484,
          name: "Jogo de Chaves Combinadas",
          price: 14900000,
          currency: "BRL",
          stock: 100,
          images: ["https://cf.shopee.com.br/file/img2.jpg"],
        },
      ],
      errors: [],
      executionTime: 120,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("supabase.co/auth/v1/user")) {
        return new Response(
          JSON.stringify({
            id: "master-uuid-1",
            email: "contato.pubcore@gmail.com",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("supabase.co/rest/v1/profiles")) {
        return new Response(JSON.stringify({ role: "MASTER" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("pub-ecom-catalog-worker")) {
        capturedUpstreamRequest = input instanceof Request ? input : new Request(input, init);
        return new Response(JSON.stringify(mockWorkerResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return originalFetch(input, init);
    });

    const mockEnv = {
      SUPABASE_URL: "https://vtcnundfslqqlxdyrogv.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      CATALOG_WORKER_URL: "https://pub-ecom-catalog-worker.contato-pubcore.workers.dev",
      CATALOG_WORKER_TOKEN: "valid-worker-token-xxz",
    };

    const req = new Request(
      "https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev/api/ingestion/shopee",
      {
        method: "POST",
        headers: {
          Origin: "https://pubecomhub.com",
          Authorization: "Bearer " + MASTER_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: targetUrl,
          limit: 10,
        }),
      },
    );

    const response = await handleCatalogProxy(req, mockEnv as any);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);

    const data = await response!.json();
    expect(data.success).toBe(true);
    expect(data.shopId).toBe("1729928484");
    expect(data.data.length).toBe(2);
    expect(data.data[0].name).toBe("Furadeira de Impacto Profissional");

    expect(capturedUpstreamRequest).not.toBeNull();
    expect(capturedUpstreamRequest!.headers.get("authorization")).toBe(
      "Bearer valid-worker-token-xxz",
    );

    globalThis.fetch = originalFetch;
  });
});
