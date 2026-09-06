import { createFileRoute } from "@tanstack/react-router";
import { handleCatalogProxy } from "@/server/catalogProxy";

export const Route = createFileRoute("/api/catalog/stores/$storeId/refresh")({
  server: {
    handlers: {
      POST: async ({ request }): Promise<Response> => {
        const response = await handleCatalogProxy(request);
        return (
          response ||
          new Response(JSON.stringify({ error: "Endpoint proxy não encontrado" }), { status: 404 })
        );
      },
    },
  },
});
