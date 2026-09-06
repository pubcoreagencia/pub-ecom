import { createFileRoute } from "@tanstack/react-router";
import { handleCatalogProxy, handleCorsPreflight, getCorsHeaders } from "@/server/catalogProxy";
import { validateTargetUrl } from "@/lib/ingestion/security/urlValidator";
import { z } from "zod";

export const Route = createFileRoute("/api/ingestion/shopee")({
  server: {
    handlers: {
      OPTIONS: async ({ request }): Promise<Response> => {
        const preflight = handleCorsPreflight(request);
        return preflight || new Response(null, { status: 204 });
      },
      POST: async ({ request }): Promise<Response> => {
        const cors = getCorsHeaders(request);
        try {
          // Pre-flight SSRF validation
          const clone = request.clone();
          const body = await clone.json();
          const targetUrl = z.object({ url: z.string().url() }).parse(body).url;

          validateTargetUrl(targetUrl);

          const response = await handleCatalogProxy(request);
          return (
            response ||
            new Response(JSON.stringify({ error: "Endpoint proxy não encontrado" }), {
              status: 404,
              headers: { "content-type": "application/json", ...cors },
            })
          );
        } catch (err: any) {
          console.error("[ShopeeIngestion] Erro na validação ou execução:", err);
          return new Response(
            JSON.stringify({
              success: false,
              error: err.message || "Erro interno na ingestão da Shopee",
            }),
            {
              status: err.message?.includes("SSRF") ? 403 : 400,
              headers: { "content-type": "application/json", ...cors },
            },
          );
        }
      },
    },
  },
});
