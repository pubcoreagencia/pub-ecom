import { Product, IProductRepository } from "@/types";
import { mockProducts } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";

export class ProductRepository implements IProductRepository {
  private useMock = true;

  async getAll(): Promise<Product[]> {
    if (this.useMock) {
      return [...mockProducts];
    }

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, price, cost, supplier_id, store_id, stock, image_url, master_product_id, custom_name, custom_description, custom_image_url, profit_margin, status, created_at",
      );

    if (error) throw error;
    return (data || []).map(this.mapDbProductToType);
  }

  async getByStore(storeId: string): Promise<Product[]> {
    if (this.useMock) {
      return mockProducts.filter((p) => p.storeId === storeId);
    }

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, price, cost, supplier_id, store_id, stock, image_url, master_product_id, custom_name, custom_description, custom_image_url, profit_margin, status, created_at",
      )
      .eq("store_id", storeId);

    if (error) throw error;
    return (data || []).map(this.mapDbProductToType);
  }

  /**
   * Public storefront product list (excludes cost and profit_margin)
   */
  async getPublicByStore(storeId: string): Promise<Product[]> {
    if (this.useMock) {
      return mockProducts
        .filter((p) => p.storeId === storeId)
        .map((p) => ({
          ...p,
          cost: 0,
          profitMargin: undefined,
        }));
    }

    const { data, error } = await supabase
      .from("public_store_products" as any)
      .select(
        "id, store_id, master_product_id, name, description, price, stock, image_url, status, created_at, updated_at" as any,
      )
      .eq("store_id", storeId);

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      cost: 0, // Stripped in public view
      supplierId: "",
      storeId: row.store_id || "",
      stock: row.stock,
      image: row.image_url ?? undefined,
      masterProductId: row.master_product_id ?? undefined,
      customName: row.name,
      customDescription: row.description ?? undefined,
      customImageUrl: row.image_url ?? undefined,
      profitMargin: undefined, // Stripped in public view
      status: row.status as "active" | "inactive",
      created_at: row.created_at ?? undefined,
    }));
  }

  async getById(id: string): Promise<Product | null> {
    if (this.useMock) {
      return mockProducts.find((p) => p.id === id) || null;
    }

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, price, cost, supplier_id, store_id, stock, image_url, master_product_id, custom_name, custom_description, custom_image_url, profit_margin, status, created_at",
      )
      .eq("id", id)
      .single();

    if (error) return null;
    return this.mapDbProductToType(data);
  }

  private mapDbProductToType(dbProduct: any): Product {
    const product: Product = {
      id: dbProduct.id,
      name: dbProduct.name,
      price: Number(dbProduct.price),
      cost: Number(dbProduct.cost || 0),
      supplierId: dbProduct.supplier_id || "",
      storeId: dbProduct.store_id || "",
      stock: dbProduct.stock,
      image: dbProduct.image_url ?? undefined,
      created_at: dbProduct.created_at,
    };

    if (dbProduct.master_product_id) product.masterProductId = dbProduct.master_product_id;
    if (dbProduct.custom_name) product.customName = dbProduct.custom_name;
    if (dbProduct.custom_description) product.customDescription = dbProduct.custom_description;
    if (dbProduct.custom_image_url) product.customImageUrl = dbProduct.custom_image_url;
    if (dbProduct.profit_margin !== undefined && dbProduct.profit_margin !== null) {
      product.profitMargin = Number(dbProduct.profit_margin);
    }
    if (dbProduct.status) product.status = dbProduct.status as "active" | "inactive";

    return product;
  }
}

export const productRepository = new ProductRepository();
