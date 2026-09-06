import { ExecutionProvider, ExecutionResult } from "./ExecutionProvider";
import { runShopeeWorker } from "../workers/ShopeeWorker.server";
import { CloudflareExecutionProvider } from "./CloudflareExecutionProvider";
import { getCatalogWorkerUrl } from "@/server/env";

export class ShopeeExecutionProvider implements ExecutionProvider<any> {
  async execute(params: Record<string, any>): Promise<ExecutionResult<any>> {
    const { url, limit = 50, shopId } = params;

    // Check if external worker is configured
    const workerUrl = getCatalogWorkerUrl();

    if (workerUrl) {
      console.log(`[ShopeeExecutionProvider] Using Cloudflare External Worker: ${workerUrl}`);
      try {
        const cloudflareProvider = new CloudflareExecutionProvider();
        return await cloudflareProvider.execute(params);
      } catch (error: any) {
        console.warn(
          `[ShopeeExecutionProvider] External worker failed, logging error:`,
          error.message,
        );
        // We don't automatically fallback to local Playwright if the external worker was intended,
        // as local Playwright is likely to fail with 403 in the same environment.
        return {
          data: [],
          totalFound: 0,
          errors: [`Falha no Worker Externo: ${error.message}`],
          metadata: { error: true, provider: "cloudflare" },
        };
      }
    }

    console.log(`[ShopeeExecutionProvider] Using local Node worker for shop: ${shopId || url}`);

    try {
      // Execute the server-side worker locally
      const result = await runShopeeWorker({
        url,
        shopId,
        limit,
        pageSize: 30,
      });

      return {
        data: result.items,
        totalFound: result.items.length,
        errors: result.errors,
        metadata: {
          shopId: result.shopId,
          source: "shopee_worker_local",
          executionTime: result.executionTime,
        },
      };
    } catch (error: any) {
      console.error(`[ShopeeExecutionProvider] Local worker execution failed:`, error);
      return {
        data: [],
        totalFound: 0,
        errors: [error.message || "Erro desconhecido na execução do worker local"],
        metadata: { error: true, provider: "local" },
      };
    }
  }
}
