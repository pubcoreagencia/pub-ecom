/**
 * Centralized Server-Side Environment & Secrets Resolver
 * Safely accesses Cloudflare Workers bindings (env), globalThis.__env__, and process.env
 */

let globalServerEnv: Record<string, any> = {};

export function setServerEnv(env: unknown) {
  if (env && typeof env === "object") {
    globalServerEnv = { ...globalServerEnv, ...(env as Record<string, any>) };
    try {
      if (typeof process !== "undefined" && process.env) {
        Object.assign(process.env, env);
      }
    } catch {
      // ignore if process.env is read-only
    }
  }
}

export function getServerEnv(request?: Request): Record<string, any> {
  const procEnv = typeof process !== "undefined" && process.env ? process.env : {};
  const gThis = typeof globalThis !== "undefined" ? (globalThis as Record<string, any>) : {};

  // Nitro stores the Cloudflare env on globalThis['__env__']
  const nitroEnv =
    typeof gThis["__env__"] === "object" && gThis["__env__"] !== null ? gThis["__env__"] : {};
  const directGlobalEnv =
    typeof gThis["env"] === "object" && gThis["env"] !== null ? gThis["env"] : {};

  // Request-attached Cloudflare context
  const reqRuntimeEnv = (request && (request as any).runtime?.cloudflare?.env) || {};
  const reqEnv = (request && (request as any).env) || {};

  return {
    ...procEnv,
    ...nitroEnv,
    ...directGlobalEnv,
    ...globalServerEnv,
    ...reqRuntimeEnv,
    ...reqEnv,
  };
}

export function getCatalogWorkerToken(request?: Request): string {
  const env = getServerEnv(request);
  return (env["CATALOG_WORKER_TOKEN"] || env["VITE_CATALOG_API_TOKEN"] || "").trim();
}

export function getCatalogWorkerUrl(request?: Request): string {
  const env = getServerEnv(request);
  return (
    env["CATALOG_WORKER_URL"] ||
    env["VITE_CATALOG_API_URL"] ||
    "https://pub-ecom-catalog-worker.contato-pubcore.workers.dev"
  ).replace(/\/+$/, "");
}

export function getSupabaseCredentials(request?: Request): { url: string; key: string } {
  const env = getServerEnv(request);
  const url = env["SUPABASE_URL"] || env["VITE_SUPABASE_URL"] || "";
  const key =
    env["SUPABASE_SERVICE_ROLE_KEY"] ||
    env["SUPABASE_PUBLISHABLE_KEY"] ||
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    "";
  return { url, key };
}
