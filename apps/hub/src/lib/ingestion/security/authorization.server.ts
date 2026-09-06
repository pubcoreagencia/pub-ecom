import { UserRole } from "@/types";

export interface AuthContext {
  userId: string;
  role: UserRole;
  claims: any;
}

/**
 * Validates if the authenticated user has permission to perform ingestion/refresh for a store.
 * MASTER: Always allowed.
 * LOJISTA: Allowed if they own the store.
 * Others: Denied.
 */
export async function validateStoreAccess(auth: AuthContext, storeId?: string): Promise<boolean> {
  // 1. MASTER is globally authorized
  if (auth.role === "MASTER") {
    return true;
  }

  // 2. LOJISTA is authorized only for their own stores
  if (auth.role === "LOJISTA") {
    if (!storeId) {
      return false;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .select("owner_id")
      .eq("id", storeId)
      .maybeSingle();

    if (error || !store) return false;
    return store.owner_id === auth.userId;
  }

  // 3. Deny all other roles by default
  return false;
}

/**
 * Validates if the user is authorized for general ingestion discovery (without a specific store).
 * requirement: MASTER: autorizado globalmente.
 */
export async function validateIngestionAccess(auth: AuthContext): Promise<boolean> {
  return auth.role === "MASTER";
}
