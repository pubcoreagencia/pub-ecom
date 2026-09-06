import {
  CatalogStats,
  Store,
  Product,
  SyncResponse,
  IngestionApiResponse,
  Supplier,
  StorefrontStore,
  SupplierExportData,
} from "./types";
import { supabase } from "@/integrations/supabase/client";

function getApiBaseUrl(): string {
  // If explicitly provided via environment variable, respect it
  const overrideUrl = (import.meta.env["VITE_CATALOG_API_URL"] || "").trim();
  if (overrideUrl.length > 0) {
    return overrideUrl.endsWith("/") ? overrideUrl.slice(0, -1) : overrideUrl;
  }

  // In browser runtime:
  if (typeof window !== "undefined") {
    const hostname = window.location?.hostname || "";
    // When running in local development without custom override:
    // Route API requests to the Cloudflare Hub Worker backend
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev";
    }

    // In production (e.g. workers.dev or custom production domain), use relative path
    return "";
  }

  // Server-side fallback
  return "https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev";
}

function normalizeStore(raw: any): Store {
  return {
    id: raw.id || `shopee:${raw.sourceStoreId || raw.shopId || "unknown"}`,
    name: raw.name || raw.username || "Loja Shopee",
    username: raw.username || raw.sourceStoreId || "",
    source: raw.source || "shopee",
    shopId: raw.sourceStoreId || raw.shopId || "",
    status: raw.status || "active",
    syncState: raw.syncState || (raw.status === "active" ? "success" : "idle"),
    productCount: Number(raw.productCount) || 0,
    lastSyncAt: raw.lastSyncAt || null,
    lastSyncStatus: raw.lastSyncStatus || null,
    metadata: raw.metadata || {},
  };
}

function normalizeProduct(raw: any): Product {
  return {
    id:
      raw.id ||
      `${raw.source || "shopee"}:${raw.sourceStoreId || ""}:${raw.externalProductId || raw.externalId || ""}`,
    externalId: raw.externalProductId || raw.externalId || raw.itemId || "",
    storeId: raw.sourceStoreId || raw.storeId || raw.shopId || "",
    title: raw.title || "",
    description: raw.description || null,
    price: typeof raw.price === "number" ? raw.price : Number(raw.price) || 0,
    currency: raw.currency || "BRL",
    images: Array.isArray(raw.images) ? raw.images : [],
    url: raw.sourceProductUrl || raw.url || raw.productUrl || "",
    sku: raw.sku || null,
    category: raw.category || null,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    metadata: raw.metadata || {},
  };
}

export class CatalogApi {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${path}`;
    const headers = new Headers(options.headers);

    if (!headers.has("Content-Type") && options.method !== "GET" && options.method !== "HEAD") {
      headers.set("Content-Type", "application/json");
    }

    // Automatically obtain and inject the authenticated Supabase session access token
    if (!headers.has("Authorization") && !headers.has("authorization")) {
      try {
        const { data } = await supabase.auth.getSession();
        let session = data?.session;

        // If session is expiring soon or expired, attempt refresh
        if (session) {
          const now = Math.floor(Date.now() / 1000);
          if (session.expires_at && session.expires_at - now < 30) {
            const refreshRes = await supabase.auth.refreshSession();
            if (refreshRes.data?.session) {
              session = refreshRes.data.session;
            }
          }
        }

        const token = session?.access_token;

        if (token) {
          // Forensic validation of token expiration (issuer check removed for official migration)
          try {
            const parts = token.split(".");
            const rawPayload = parts[1];
            if (parts.length >= 2 && rawPayload) {
              const base64 = rawPayload.replace(/-/g, "+").replace(/_/g, "/");
              const jsonStr =
                typeof atob !== "undefined"
                  ? atob(base64)
                  : Buffer.from(base64, "base64").toString("utf-8");
              const payload = JSON.parse(jsonStr);
              const now = Math.floor(Date.now() / 1000);
              if (payload.exp && payload.exp < now) {
                console.warn("[CatalogApi] Token expirado detectado");
                await supabase.auth.signOut();
                const err = new Error("Sessão expirada. Faça login novamente.") as any;
                err.status = 401;
                err.isAuthError = true;
                throw err;
              }
            }
          } catch (jwtErr: any) {
            if (jwtErr?.isAuthError) throw jwtErr;
          }

          headers.set("Authorization", `Bearer ${token}`);
        } else if (typeof window !== "undefined") {
          // If in browser and not authenticated, fail early with a clear message
          const error = new Error(
            "Usuário não autenticado. Faça login no Supabase para acessar o catálogo.",
          ) as any;
          error.status = 401;
          error.isAuthError = true;
          throw error;
        }
      } catch (authErr: any) {
        if (authErr?.isAuthError) {
          throw authErr;
        }
        console.warn("[CatalogApi] Não foi possível carregar a sessão Supabase:", authErr);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err: any) {
      throw new Error(`Falha de conexão com a API do Catálogo: ${err.message || String(err)}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401 || errorData.isAuthError) {
        const error = new Error(
          errorData.error || "Catalog API: autenticação não configurada ou sessão expirada.",
        ) as any;
        error.status = 401;
        error.isAuthError = true;
        error.data = errorData;
        throw error;
      }

      if (response.status === 403) {
        const error = new Error(
          errorData.error || "Acesso negado: você não tem permissão para realizar esta operação.",
        ) as any;
        error.status = 403;
        error.data = errorData;
        throw error;
      }

      const errorMsg = errorData.error || errorData.message || `Erro HTTP ${response.status}`;
      const error = new Error(errorMsg) as any;
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    return response.json();
  }

  async getStats(): Promise<CatalogStats> {
    const data = await this.request<any>("/api/catalog/stats");
    return data;
  }

  async createStore(
    url: string,
    name?: string,
    source?: string,
  ): Promise<{ success: boolean; store: Store; message?: string }> {
    const data = await this.request<any>("/api/catalog/stores", {
      method: "POST",
      body: JSON.stringify({ url, name, source }),
    });
    return {
      success: data.success ?? true,
      store: normalizeStore(data.store),
      message: data.message,
    };
  }

  async updateStoreStatus(
    storeId: string,
    status: "active" | "inactive",
  ): Promise<{ success: boolean; store: Store }> {
    const data = await this.request<any>(`/api/catalog/stores/${encodeURIComponent(storeId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return {
      success: data.success ?? true,
      store: normalizeStore(data.store),
    };
  }

  async getStores(): Promise<Store[]> {
    const data = await this.request<any>("/api/catalog/stores");
    const rawList = data.items || data.stores || [];
    return Array.isArray(rawList) ? rawList.map(normalizeStore) : [];
  }

  async getStore(id: string): Promise<Store> {
    const data = await this.request<any>(`/api/catalog/stores/${encodeURIComponent(id)}`);
    const raw = data.item || data.store || data;
    return normalizeStore(raw);
  }

  async getStoreProducts(storeId: string): Promise<Product[]> {
    const data = await this.request<any>(
      `/api/catalog/stores/${encodeURIComponent(storeId)}/products`,
    );
    const rawList = data.items || data.products || [];
    return Array.isArray(rawList) ? rawList.map(normalizeProduct) : [];
  }

  async getStoreSyncRuns(
    storeId: string,
    params?: { limit?: number; offset?: number; status?: string },
  ): Promise<{ runs: any[]; total: number }> {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    const data = await this.request<any>(
      `/api/catalog/stores/${encodeURIComponent(storeId)}/sync-runs${query}`,
    );
    return {
      runs: data.runs || [],
      total: data.total || 0,
    };
  }

  async getStoreSyncRun(storeId: string, runId: string): Promise<any> {
    const data = await this.request<any>(
      `/api/catalog/stores/${encodeURIComponent(storeId)}/sync-runs/${encodeURIComponent(runId)}`,
    );
    return data.run;
  }

  async getStoreStatus(storeId: string): Promise<any> {
    const data = await this.request<any>(
      `/api/catalog/stores/${encodeURIComponent(storeId)}/status`,
    );
    return data;
  }

  async refreshStore(
    storeId: string,
    limit: 1 | 5 | 10 | 50 | 100 | 0 = 10,
  ): Promise<SyncResponse> {
    const data = await this.request<any>(
      `/api/catalog/stores/${encodeURIComponent(storeId)}/refresh`,
      {
        method: "POST",
        body: JSON.stringify({ limit }),
      },
    );

    const syncInfo = data.sync || {};
    return {
      success: data.success ?? true,
      syncRunId: syncInfo.syncRunId || data.syncRunId || "",
      message: data.message || "Sincronização realizada com sucesso",
      results: {
        productsFound: syncInfo.productsFound ?? 0,
        created: syncInfo.created ?? 0,
        updated: syncInfo.updated ?? 0,
        unchanged: syncInfo.unchanged ?? 0,
        failed: syncInfo.failed ?? 0,
        provider: syncInfo.provider || "shopee",
        duration: syncInfo.durationMs ?? syncInfo.duration ?? 0,
        syncRunId: syncInfo.syncRunId,
      },
    };
  }

  async getProducts(params?: Record<string, string>): Promise<Product[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const data = await this.request<any>(`/api/catalog/products${query}`);
    const rawList = data.items || data.products || [];
    return Array.isArray(rawList) ? rawList.map(normalizeProduct) : [];
  }

  async getProduct(id: string): Promise<Product> {
    const data = await this.request<any>(`/api/catalog/products/${encodeURIComponent(id)}`);
    const raw = data.item || data.product || data;
    return normalizeProduct(raw);
  }

  async updateProduct(
    id: string,
    patch: Partial<Product>,
  ): Promise<{ success: boolean; item?: Product | undefined; message?: string | undefined }> {
    const data = await this.request<any>(`/api/catalog/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return {
      success: data.success ?? true,
      message: data.message ?? undefined,
      item: data.item ? normalizeProduct(data.item) : undefined,
    };
  }

  async ingestShopee(url: string, limit = 30): Promise<IngestionApiResponse> {
    const data = await this.request<IngestionApiResponse>("/api/ingestion/shopee", {
      method: "POST",
      body: JSON.stringify({ url, limit }),
    });
    return data;
  }

  async deleteStore(storeId: string): Promise<{ success: boolean; message?: string }> {
    return this.request<any>(`/api/catalog/stores/${encodeURIComponent(storeId)}`, {
      method: "DELETE",
    });
  }

  async deleteProduct(id: string): Promise<{ success: boolean; message?: string }> {
    return this.request<any>(`/api/catalog/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  // ==========================================
  // FORNECEDORES (SUPPLIERS)
  // ==========================================
  async getSuppliers(): Promise<Supplier[]> {
    return this.getStores();
  }

  async getSupplier(id: string): Promise<Supplier> {
    return this.getStore(id);
  }

  async createSupplier(url: string, name?: string, source?: string) {
    return this.createStore(url, name, source);
  }

  async deleteSupplier(id: string): Promise<{ success: boolean; message?: string }> {
    return this.deleteStore(id);
  }

  async refreshSupplier(
    id: string,
    limit: 1 | 5 | 10 | 50 | 100 | 0 = 10,
  ): Promise<SyncResponse> {
    return this.refreshStore(id, limit);
  }

  async exportSupplierCatalog(supplierId: string): Promise<SupplierExportData> {
    const [supplier, products] = await Promise.all([
      this.getStore(supplierId),
      this.getStoreProducts(supplierId),
    ]);
    return {
      supplier,
      exportedAt: new Date().toISOString(),
      totalProducts: products.length,
      products,
    };
  }

  async downloadSupplierExport(supplierId: string, format: "json" | "csv" = "json"): Promise<void> {
    const data = await this.exportSupplierCatalog(supplierId);
    const safeName = (data.supplier.name || "fornecedor")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");
    const filename = `catalogo-${safeName}-${Date.now()}`;

    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const headers = ["ID", "Título", "SKU", "Preço", "Moeda", "Categoria", "URL_Original", "Imagens"];
      const rows = data.products.map((p) => [
        `"${p.id}"`,
        `"${(p.title || "").replace(/"/g, '""')}"`,
        `"${p.sku || ""}"`,
        p.price,
        `"${p.currency}"`,
        `"${p.category || ""}"`,
        `"${p.url || ""}"`,
        `"${(p.images || []).join(";")}"`,
      ]);
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // ==========================================
  // VITRINES DE VENDA (CLIENT STOREFRONTS)
  // ==========================================
  private defaultStorefronts: StorefrontStore[] = [
    {
      id: "store-tech-zone",
      name: "Tech Zone Store",
      slug: "tech-zone",
      niche: "Eletrônicos & Tech",
      description: "Vitrine de alta performance em eletrônicos, setup gamer e periféricos.",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60",
      bannerUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=80",
      status: "published",
      templateId: "tech-dark",
      colors: {
        primary: "#06b6d4",
        secondary: "#3b82f6",
        background: "#0a0a0c",
        surface: "#141418",
        text: "#f8fafc",
        textMuted: "#94a3b8",
        border: "#27272a",
      },
      sections: [
        {
          id: "sec-1",
          type: "announcement",
          title: "Barra de Anúncios",
          enabled: true,
          content: { message: "⚡ FRETE GRÁTIS EM TODA LINHA TECH ACIMA DE R$ 199", linkText: "Comprar Agora" },
        },
        {
          id: "sec-2",
          type: "hero",
          title: "Banner Principal Hero",
          enabled: true,
          content: {
            headline: "O FUTURO DO SEU SETUP COMEÇA AQUI",
            subheadline: "Produtos selecionados com garantia oficial e despacho imediato para todo o Brasil.",
            ctaText: "Explorar Produtos",
            badge: "Lançamentos 2026",
          },
        },
        {
          id: "sec-3",
          type: "benefits",
          title: "Vantagens da Loja",
          enabled: true,
          content: {
            b1Title: "Envio Imediato", b1Desc: "Despacho em até 24h úteis",
            b2Title: "Garantia Total", b2Desc: "30 dias para trocas e devoluções",
            b3Title: "Compra 100% Segura", b3Desc: "Criptografia ponta a ponta",
            b4Title: "Suporte VIP", b4Desc: "Atendimento dedicado via WhatsApp",
          },
        },
        {
          id: "sec-4",
          type: "featured_products",
          title: "Vitrine em Destaque",
          enabled: true,
          content: { limit: 8, layout: "grid-4" },
        },
        {
          id: "sec-5",
          type: "newsletter",
          title: "Captura de Clientes",
          enabled: true,
          content: { headline: "Receba cupons exclusivos no seu e-mail", buttonText: "Cadastrar" },
        },
      ],
      assignedProductIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        visits: 3420,
        orders: 142,
        revenue: 48920.5,
        conversionRate: 4.15,
      },
    },
    {
      id: "store-nordic-minimal",
      name: "Nordic Minimal Decor",
      slug: "nordic-minimal",
      niche: "Casa & Decoração",
      description: "Estética escandinava, sofisticação e conforto para sua casa.",
      logoUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&auto=format&fit=crop&q=60",
      bannerUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&auto=format&fit=crop&q=80",
      status: "published",
      templateId: "cozy-home",
      colors: {
        primary: "#d97706",
        secondary: "#b45309",
        background: "#0c0a09",
        surface: "#1c1917",
        text: "#fafaf9",
        textMuted: "#a8a29e",
        border: "#292524",
      },
      sections: [
        {
          id: "sec-1",
          type: "announcement",
          title: "Barra de Anúncios",
          enabled: true,
          content: { message: "🌿 Coleção Casa Conforto com até 30% OFF", linkText: "Ver Coleção" },
        },
        {
          id: "sec-2",
          type: "hero",
          title: "Banner Principal Hero",
          enabled: true,
          content: {
            headline: "DESIGN ESCANDINAVO PARA O SEU LAR",
            subheadline: "Peças exclusivas com acabamento artesanal e sustentabilidade comprovada.",
            ctaText: "Descobrir Coleção",
            badge: "Edição Limitada",
          },
        },
        {
          id: "sec-3",
          type: "featured_products",
          title: "Vitrine em Destaque",
          enabled: true,
          content: { limit: 6, layout: "grid-3" },
        },
      ],
      assignedProductIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        visits: 1890,
        orders: 68,
        revenue: 29400.0,
        conversionRate: 3.6,
      },
    },
  ];

  private getStoredStorefronts(): StorefrontStore[] {
    if (typeof window === "undefined") return this.defaultStorefronts;
    try {
      const raw = localStorage.getItem("pub_ecom_storefronts");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return this.defaultStorefronts;
  }

  private saveStoredStorefronts(stores: StorefrontStore[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("pub_ecom_storefronts", JSON.stringify(stores));
    } catch {}
  }

  async getStorefronts(): Promise<StorefrontStore[]> {
    return this.getStoredStorefronts();
  }

  async getStorefront(idOrSlug: string): Promise<StorefrontStore | null> {
    const list = this.getStoredStorefronts();
    return list.find((s) => s.id === idOrSlug || s.slug === idOrSlug) || null;
  }

  async createStorefront(data: Partial<StorefrontStore>): Promise<StorefrontStore> {
    const list = this.getStoredStorefronts();
    const id = `store-${Date.now()}`;
    const slug = (data.slug || data.name || "loja")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    const newStore: StorefrontStore = {
      id,
      name: data.name || "Nova Loja Virtual",
      slug,
      niche: data.niche || "Geral & Variedades",
      description: data.description || "Vitrine oficial de produtos selecionados.",
      logoUrl: data.logoUrl || null,
      bannerUrl: data.bannerUrl || null,
      status: data.status || "published",
      templateId: data.templateId || "tech-dark",
      colors: data.colors || {
        primary: "#38bdf8",
        secondary: "#6366f1",
        background: "#09090b",
        surface: "#18181b",
        text: "#fafafa",
        textMuted: "#a1a1aa",
        border: "#27272a",
      },
      sections: data.sections || [
        {
          id: "sec-ann",
          type: "announcement",
          title: "Barra de Anúncios",
          enabled: true,
          content: { message: "⚡ OFERTAS EXCLUSIVAS POR TEMPO LIMITADO" },
        },
        {
          id: "sec-hero",
          type: "hero",
          title: "Banner Hero",
          enabled: true,
          content: {
            headline: "BEM-VINDO À NOSSA LOJA",
            subheadline: "Os melhores produtos selecionados com garantia e entrega rápida.",
            ctaText: "Ver Produtos",
          },
        },
        {
          id: "sec-feat",
          type: "featured_products",
          title: "Produtos em Destaque",
          enabled: true,
          content: { limit: 8 },
        },
        {
          id: "sec-benefits",
          type: "benefits",
          title: "Vantagens",
          enabled: true,
          content: {},
        },
      ],
      assignedProductIds: data.assignedProductIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        visits: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0,
      },
    };

    const nextList = [newStore, ...list];
    this.saveStoredStorefronts(nextList);
    return newStore;
  }

  async updateStorefront(id: string, patch: Partial<StorefrontStore>): Promise<StorefrontStore> {
    const list = this.getStoredStorefronts();
    const idx = list.findIndex((s) => s.id === id || s.slug === id);
    if (idx === -1) {
      throw new Error(`Storefront '${id}' não encontrada`);
    }

    const current = list[idx]!;
    const updated: StorefrontStore = {
      ...current,
      ...patch,
      colors: patch.colors ? { ...current.colors, ...patch.colors } : current.colors,
      sections: patch.sections || current.sections,
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    this.saveStoredStorefronts(list);
    return updated;
  }

  async deleteStorefront(id: string): Promise<boolean> {
    const list = this.getStoredStorefronts();
    const nextList = list.filter((s) => s.id !== id && s.slug !== id);
    this.saveStoredStorefronts(nextList);
    return true;
  }
}

export const catalogApi = new CatalogApi();
