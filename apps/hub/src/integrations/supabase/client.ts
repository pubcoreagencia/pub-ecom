import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const OFFICIAL_SUPABASE_URL = "https://rouxgtjonfncswsqlcgz.supabase.co";
export const OFFICIAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_mVSsfkvuVTXs6W0hrzV0Kw_W-dT3a0N";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function cleanForeignSupabaseStorage() {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key?.startsWith("sb-") &&
        key.endsWith("-auth-token") &&
        !key.includes("rouxgtjonfncswsqlcgz")
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export function createSupabaseClient() {
  const rawUrl = import.meta.env["VITE_SUPABASE_URL"];
  const rawKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  const SUPABASE_URL =
    rawUrl && rawUrl.startsWith("http") ? rawUrl : OFFICIAL_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    rawKey && rawKey.length > 20 ? rawKey : OFFICIAL_SUPABASE_PUBLISHABLE_KEY;

  cleanForeignSupabaseStorage();

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
