import { ExecutionProvider, ExecutionResult } from "./ExecutionProvider";
import { getCatalogWorkerToken, getCatalogWorkerUrl } from "@/server/env";

export class CloudflareExecutionProvider implements ExecutionProvider<any> {
  async execute(params: Record<string, any>): Promise<ExecutionResult<any>> {
    const { url, limit = 50, shopId } = params;

    const workerUrl = getCatalogWorkerUrl();
    const workerToken = getCatalogWorkerToken();

    console.log(`[CloudflareExecutionProvider] Routing request to external worker: ${workerUrl}`);

    try {
      const response = await fetch(`${workerUrl}/ingestion/shopee`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(workerToken ? { Authorization: `Bearer ${workerToken}` } : {}),
        },
        body: JSON.stringify({
          url,
          limit,
          shopId,
          pageSize: 30,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker Externo erro (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      return {
        data: result.items || [],
        totalFound: (result.items || []).length,
        errors: result.errors || [],
        metadata: {
          shopId: result.shopId,
          source: "cloudflare_browser_run",
          executionTime: result.metadata?.executionTime || 0,
          external: true,
        },
      };
    } catch (error: any) {
      console.error(`[CloudflareExecutionProvider] External execution failed:`, error);
      throw error;
    }
  }
}
