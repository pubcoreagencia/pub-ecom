import { CatalogSourceAdapter, RawProduct } from "../types";

export class MockAdapter implements CatalogSourceAdapter {
  canHandle(url: string): boolean {
    return url.includes("mock-source.com");
  }

  async discover(url: string): Promise<RawProduct[]> {
    console.log(`MockAdapter: Simulating discovery for ${url}`);

    // Simula atraso de rede
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return [
      {
        externalId: "mock_p1",
        url: `${url}/product/1`,
        title: "Smartphone Premium X1",
        description: "Um smartphone potente com câmera de 108MP",
        price: 1200.0,
        sku: "SM-X1-RED",
        images: ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80"],
        category: "Eletrônicos",
        metadata: { brand: "MockBrand", stock: 50 },
      },
      {
        externalId: "mock_p2",
        url: `${url}/product/2`,
        title: "Fone de Ouvido Noise Cancelling",
        description: "Som cristalino com cancelamento de ruído ativo",
        price: 350.0,
        sku: "NC-HEAD-02",
        images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80"],
        category: "Acessórios",
        metadata: { brand: "AudioMaster", stock: 120 },
      },
      {
        externalId: "mock_p3",
        url: `${url}/product/3`,
        title: "Relógio Inteligente Sport",
        description: "Monitore sua saúde 24h por dia",
        price: 280.0,
        sku: "SW-SPORT-BLK",
        images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"],
        category: "Eletrônicos",
        metadata: { brand: "FitTech", stock: 85 },
      },
    ];
  }
}
