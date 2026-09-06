import { ExecutionProvider, ExecutionResult } from "./ExecutionProvider";

export class MockExecutionProvider implements ExecutionProvider<any> {
  async execute(params: Record<string, any>): Promise<ExecutionResult<any>> {
    const { url, limit = 10 } = params;

    console.log(`[MockExecutionProvider] Simulating execution for: ${url}`);

    const mockItems = Array.from({ length: limit }).map((_, i) => ({
      itemid: `mock-${i}`,
      shopid: `shop-${url.split("/").pop()}`,
      name: `Produto Mock ${i + 1} da Loja`,
      price: 9990000 + i * 1000000, // Scaled price like Shopee
      stock: 10 + i,
      images: ["https://placehold.co/600x600?text=Shopee+Mock"],
      historical_sold: 100 + i,
    }));

    return {
      data: mockItems,
      totalFound: mockItems.length,
      errors: [],
      metadata: { source: "mock", timestamp: new Date().toISOString() },
    };
  }
}
