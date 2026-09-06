import { supabase } from "@/integrations/supabase/client";
import { MasterProduct } from "@/types";

export class MasterProductRepository {
  /**
   * Find commercial products (safe for Lojistas and standard authenticated browsing)
   * Queries the secure available_master_products view where supplier_cost is omitted.
   */
  async findCommercial(): Promise<MasterProduct[]> {
    const { data, error } = await (supabase.from("available_master_products" as any) as any)
      .select(
        "id, sku, name, description, image_url, category, base_price_pub, status, is_available, metadata, created_at, updated_at" as any,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapCommercialRowToEntity);
  }

  /**
   * Find all master products (including supplier_cost for MASTER or owning FORNECEDOR)
   * Base table RLS strictly blocks unprivileged accounts.
   */
  async findAll(): Promise<MasterProduct[]> {
    const { data, error } = await supabase
      .from("master_products")
      .select(
        "id, supplier_id, sku, name, description, image_url, category, supplier_cost, base_price_pub, status, is_available, metadata, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToEntity);
  }

  async findBySku(sku: string): Promise<MasterProduct | null> {
    const { data, error } = await (supabase.from("available_master_products" as any) as any)
      .select(
        "id, sku, name, description, image_url, category, base_price_pub, status, is_available, metadata, created_at, updated_at" as any,
      )
      .eq("sku" as any, sku)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapCommercialRowToEntity(data) : null;
  }

  async findByExternalId(externalId: string, supplierId: string): Promise<MasterProduct | null> {
    const { data, error } = await supabase
      .from("master_products")
      .select(
        "id, supplier_id, sku, name, description, image_url, category, supplier_cost, base_price_pub, status, is_available, metadata, created_at",
      )
      .eq("metadata->>external_id", externalId)
      .eq("supplier_id", supplierId)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapToEntity(data) : null;
  }

  async upsert(product: Partial<MasterProduct>): Promise<MasterProduct> {
    if (!product.supplierId || !product.sku || !product.name) {
      throw new Error("Missing required fields for MasterProduct upsert");
    }

    const { data, error } = await supabase
      .from("master_products")
      .upsert(
        {
          supplier_id: product.supplierId,
          sku: product.sku,
          name: product.name,
          description: product.description || null,
          image_url: product.imageUrl || null,
          category: product.category || null,
          supplier_cost: product.supplierCost || 0,
          base_price_pub: product.basePricePub || 0,
          status: product.status || "active",
          is_available: product.isAvailable ?? true,
          metadata: product.metadata || null,
        },
        {
          onConflict: "sku",
        },
      )
      .select(
        "id, supplier_id, sku, name, description, image_url, category, supplier_cost, base_price_pub, status, is_available, metadata, created_at",
      )
      .single();

    if (error) throw error;
    return this.mapToEntity(data);
  }

  private mapCommercialRowToEntity(row: any): MasterProduct {
    return {
      id: row.id,
      supplierId: "",
      sku: row.sku,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      category: row.category,
      supplierCost: 0, // Never exposed in commercial view
      basePricePub: Number(row.base_price_pub || 0),
      status: row.status,
      isAvailable: row.is_available,
      metadata: row.metadata,
      created_at: row.created_at,
    };
  }

  private mapToEntity(row: any): MasterProduct {
    return {
      id: row.id,
      supplierId: row.supplier_id,
      sku: row.sku,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      category: row.category,
      supplierCost:
        row.supplier_cost !== undefined && row.supplier_cost !== null
          ? Number(row.supplier_cost)
          : 0,
      basePricePub: Number(row.base_price_pub || 0),
      status: row.status,
      isAvailable: row.is_available,
      metadata: row.metadata,
      created_at: row.created_at,
    };
  }
}

export const masterProductRepository = new MasterProductRepository();
