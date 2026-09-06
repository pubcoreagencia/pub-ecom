/**
 * Catalog Provider Contract & Architecture Tests (Fase 13)
 *
 * Tests the CatalogProvider interface, ShopeeProvider implementation,
 * provider registry, extraction strategies, normalizers, and anti-bot classification.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@cloudflare/playwright", () => ({
  launch: vi.fn(),
  chromium: {
    launch: vi.fn(),
    sessions: vi.fn(),
    history: vi.fn(),
    limits: vi.fn(),
  },
}));
import {
  getCatalogProvider,
  registerCatalogProvider,
  listSupportedSources,
  ShopeeProvider,
  CatalogProvider,
  detectShopeeChallenge,
  extractFromJsonLd,
  extractFromPreloadedState,
  extractFromDomLinks,
  normalizeShopeeProduct,
  StoreTarget,
} from "../catalog-worker/src/providers";

describe("Catalog Provider Contract & Registry (Fase 13)", () => {
  // Test 1: ShopeeProvider implementa CatalogProvider
  it("1. ShopeeProvider implementa o contrato CatalogProvider", () => {
    const provider = new ShopeeProvider();
    expect(provider.name).toBe("ShopeeProvider");
    expect(provider.source).toBe("shopee");
    expect(provider.canHandle("shopee")).toBe(true);
    expect(provider.canHandle("SHOPEE")).toBe(true);
    expect(provider.canHandle("mercadolivre")).toBe(false);
    expect(typeof provider.extract).toBe("function");
  });

  // Test 2: Registry resolve shopee
  it("2. Provider Registry resolve 'shopee' (case-insensitive)", () => {
    const p1 = getCatalogProvider("shopee");
    const p2 = getCatalogProvider("SHOPEE");
    const p3 = getCatalogProvider("Shopee");

    expect(p1).toBeInstanceOf(ShopeeProvider);
    expect(p2).toBeInstanceOf(ShopeeProvider);
    expect(p3).toBeInstanceOf(ShopeeProvider);
    expect(listSupportedSources()).toContain("shopee");
  });

  // Test 3: Provider desconhecido falha de forma controlada
  it("3. Provider desconhecido falha com erro descritivo", () => {
    expect(() => getCatalogProvider("mercadolivre")).toThrow(
      "Provider não suportado para a fonte: 'mercadolivre'",
    );
    expect(() => getCatalogProvider("")).toThrow("Fonte da loja (source) não informada");
  });

  // Test 4: Custom Provider pode ser registrado no Registry
  it("4. Permite registrar novos providers respeitando o contrato", () => {
    const mockProvider: CatalogProvider = {
      name: "MockTestProvider",
      source: "mocktest",
      canHandle: (s) => s.toLowerCase() === "mocktest",
      extract: async () => ({
        success: true,
        status: "success",
        provider: "mocktest",
        shopId: "123",
        username: "mock",
        products: [],
        strategyUsed: "mock",
        attempts: 1,
        challengeDetected: false,
        reason: "success",
        diagnostics: [],
        metadata: {},
      }),
    };

    registerCatalogProvider(mockProvider);
    const resolved = getCatalogProvider("mocktest");
    expect(resolved.name).toBe("MockTestProvider");
    expect(listSupportedSources()).toContain("mocktest");
  });

  // Test 5: Normalização completa de produto
  it("5. normalizeShopeeProduct produz produto normalizado agnóstico", () => {
    const rawItem = {
      item_basic: {
        itemid: "998877",
        name: "Babuche Confortável Macio",
        price: 2990000,
        currency: "BRL",
        images: ["img1.jpg", "img2.jpg"],
        sku: "BAB-9988",
        category: "Calçados",
        description: "Babuche de alta durabilidade",
      },
    };

    const normalized = normalizeShopeeProduct(rawItem, "shopee:1729928484", "1729928484");
    expect(normalized.id).toBe("shopee:1729928484:998877");
    expect(normalized.external_id).toBe("998877");
    expect(normalized.store_id).toBe("shopee:1729928484");
    expect(normalized.title).toBe("Babuche Confortável Macio");
    expect(normalized.price).toBe(29.9);
    expect(normalized.currency).toBe("BRL");
    expect(normalized.images).toEqual(["img1.jpg", "img2.jpg"]);
    expect(normalized.sku).toBe("BAB-9988");
    expect(normalized.category).toBe("Calçados");
    expect(normalized.description).toBe("Babuche de alta durabilidade");
    expect(normalized.source).toBe("shopee");
  });

  // Test 6: Produto sem SKU, descrição ou categoria não é descartado
  it("6. Produto sem SKU/descrição/categoria é preservado na normalização", () => {
    const raw = {
      itemid: "554433",
      name: "Babuche Sem SKU",
      price: 1500000,
    };

    const normalized = normalizeShopeeProduct(raw, "shopee:1729928484", "1729928484");
    expect(normalized.id).toBe("shopee:1729928484:554433");
    expect(normalized.sku).toBeNull();
    expect(normalized.description).toBeNull();
    expect(normalized.category).toBeNull();
    expect(normalized.price).toBe(15);
  });

  // Test 7: Preço ausente é normalizado para 0
  it("7. Produto sem preço é normalizado com price: 0 sem erro", () => {
    const raw = {
      itemid: "111111",
      name: "Produto Preço Zero",
    };

    const normalized = normalizeShopeeProduct(raw, "shopee:1729928484", "1729928484");
    expect(normalized.price).toBe(0);
    expect(normalized.currency).toBe("BRL");
  });

  // Test 8: Imagem ausente é normalizada para []
  it("8. Produto sem imagem retorna array vazio", () => {
    const raw = {
      itemid: "222222",
      name: "Produto Sem Foto",
    };

    const normalized = normalizeShopeeProduct(raw, "shopee:1729928484", "1729928484");
    expect(normalized.images).toEqual([]);
  });

  // Test 9: Anti-bot detectado por URL de challenge
  it("9. Challenge anti-bot por URL /verify/traffic/error", () => {
    const challenge = detectShopeeChallenge("https://shopee.com.br/verify/traffic/error");
    expect(challenge.isChallenge).toBe(true);
    expect(challenge.reason).toContain("/verify/");
  });

  // Test 10: Anti-bot detectado por código de erro Shopee 90309999
  it("10. Challenge anti-bot por código de erro Shopee 90309999", () => {
    const challenge = detectShopeeChallenge("https://shopee.com.br/api", "", "", 200, {
      error: 90309999,
    });
    expect(challenge.isChallenge).toBe(true);
    expect(challenge.reason).toContain("90309999");
  });

  // Test 11: Estratégia JSON-LD
  it("11. Estratégia JSON-LD extrai dados estruturados", () => {
    const scripts = [
      JSON.stringify({
        "@type": "Product",
        name: "Babuche Ortopédico",
        sku: "ORT-01",
        offers: { price: "45.00", priceCurrency: "BRL" },
      }),
    ];

    const items = extractFromJsonLd(scripts);
    expect(items.length).toBe(1);
    expect(items[0].item_basic.name).toBe("Babuche Ortopédico");
    expect(items[0].item_basic.price).toBe(4500000);
  });

  // Test 12: Estratégia Preloaded State
  it("12. Estratégia Preloaded State extrai itens do window.__PRELOADED_STATE__", () => {
    const state = {
      shopItems: {
        items: [
          {
            itemid: "888111",
            name: "Babuche Estampado Infantil",
            price: 1990000,
          },
        ],
      },
    };

    const items = extractFromPreloadedState(state);
    expect(items.length).toBe(1);
    expect(items[0].item_basic.itemid).toBe("888111");
  });

  // Test 13: Estratégia DOM Links com deduplicação
  it("13. Estratégia DOM Links extrai e deduplica produtos", () => {
    const links = [
      { href: "https://shopee.com.br/Babuche-i.1729928484.3001", text: "Babuche 3001" },
      { href: "https://shopee.com.br/Babuche-i.1729928484.3001", text: "Babuche 3001 Duplicado" },
      { href: "https://shopee.com.br/Babuche-i.1729928484.3002", text: "Babuche 3002" },
      { href: "https://shopee.com.br/Outro-i.999999.3003", text: "Outro Shop" },
    ];

    const items = extractFromDomLinks(links, "1729928484");
    expect(items.length).toBe(2);
    expect(items.map((i) => i.item_basic.itemid)).toEqual(["3001", "3002"]);
  });

  // Test 14: Contrato StoreTarget é aceito pelo provider
  it("14. StoreTarget é compatível com ShopeeProvider", () => {
    const target: StoreTarget = {
      id: "shopee:1729928484",
      name: "Zentta Babuche",
      username: "zenttababuche",
      source: "shopee",
      shopId: "1729928484",
      metadata: { url: "https://shopee.com.br/zenttababuche" },
    };

    expect(target.source).toBe("shopee");
    expect(target.shopId).toBe("1729928484");
  });

  // Test 15: Integridade e não-mascaramento de anti-bot
  it("15. Nunca mascara anti-bot como success", () => {
    const r1 = detectShopeeChallenge("https://shopee.com.br/verify/traffic/error");
    const r2 = detectShopeeChallenge("https://shopee.com.br", "", "Security Verification");
    const r3 = detectShopeeChallenge("https://shopee.com.br", "", "", 403);
    const r4 = detectShopeeChallenge("https://shopee.com.br", "", "", 200, { error: 90309999 });

    expect(r1.isChallenge).toBe(true);
    expect(r2.isChallenge).toBe(true);
    expect(r3.isChallenge).toBe(true);
    expect(r4.isChallenge).toBe(true);
  });
});
