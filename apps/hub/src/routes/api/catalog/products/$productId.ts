import { createFileRoute } from "@tanstack/react-router";
import { handleCatalogProxy, handleCorsPreflight } from "@/server/catalogProxy";

export const Route = createFileRoute("/api/catalog/products/$productId")({
  server: {
    handlers: {
      OPTIONS: async ({ request }): Promise<Response> => {
        const preflight = handleCorsPreflight(request);
        return preflight || new Response(null, { status: 204 });
      },
      GET: async ({ request }): Promise<Response> => {
        const response = await handleCatalogProxy(request);
        return (
          response ||
          new Response(JSON.stringify({ error: "Endpoint proxy não encontrado" }), { status: 404 })
        );
      },
      PATCH: async ({ request }): Promise<Response> => {
        const response = await handleCatalogProxy(request);
        return (
          response ||
          new Response(JSON.stringify({ error: "Endpoint proxy não encontrado" }), { status: 404 })
        );
      },
      PUT: async ({ request }): Promise<Response> => {
        const response = await handleCatalogProxy(request);
        return (
          response ||
          new Response(JSON.stringify({ error: "Endpoint proxy não encontrado" }), { status: 404 })
        );
      },
      DELETE: async ({ request }): Promise<Response> => {
        const response = await handleCatalogProxy(request);
        return (
          response ||
          new Response(JSON.stringify({ error: "Endpoint proxy não encontrado" }), { status: 404 })
        );
      },
    },
  },
});
