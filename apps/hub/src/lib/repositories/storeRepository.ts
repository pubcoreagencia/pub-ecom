import { Store, IStoreRepository } from "@/types";
import { mockStores } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";

export class StoreRepository implements IStoreRepository {
  private useMock = true;

  async getById(id: string): Promise<Store | null> {
    if (this.useMock) {
      return mockStores.find((s) => s.id === id) || null;
    }

    const { data, error } = await supabase.from("stores").select("*").eq("id", id).single();

    if (error) return null;
    return this.mapDbStoreToType(data);
  }

  async getByOwner(ownerId: string): Promise<Store[]> {
    if (this.useMock) {
      return mockStores.filter((s) => s.ownerId === ownerId);
    }

    const { data, error } = await supabase.from("stores").select("*").eq("owner_id", ownerId);

    if (error) throw error;
    return (data || []).map(this.mapDbStoreToType);
  }

  async getBySubdomain(subdomain: string): Promise<Store | null> {
    if (this.useMock) {
      return mockStores.find((s) => s.subdomain === subdomain) || null;
    }

    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("subdomain", subdomain)
      .eq("status", "active")
      .maybeSingle();

    if (error) return null;
    return data ? this.mapDbStoreToType(data) : null;
  }

  private mapDbStoreToType(dbStore: any): Store {
    return {
      id: dbStore.id,
      name: dbStore.name,
      ownerId: dbStore.owner_id,
      subdomain: dbStore.subdomain,
      status: dbStore.status as "active" | "inactive",
      created_at: dbStore.created_at,
    };
  }
}

export const storeRepository = new StoreRepository();
