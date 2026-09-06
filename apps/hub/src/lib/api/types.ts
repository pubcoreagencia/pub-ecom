export interface CatalogStats {
  success: boolean;
  stats: {
    products: number;
    stores: number;
    activeStores: number;
    errorStores: number;
    sources: Record<string, { products: number; stores: number }>;
    sync: {
      idle: number;
      running: number;
      success: number;
      partial: number;
      error: number;
    };
  };
}

export interface Store {
  id: string; // canonicalId: e.g. "shopee:1729928484"
  name: string;
  username: string;
  source: "shopee" | string;
  shopId: string;
  status: "active" | "inactive" | "error";
  syncState: "idle" | "running" | "success" | "partial" | "failed" | "error";
  productCount: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  metadata?: Record<string, any>;
}

// Fornecedores (Fontes de Importação e Dropshipping)
export type Supplier = Store;

// Vitrines de Venda (Lojas dos Clientes - Multi-tenant Storefronts)
export type StoreNiche =
  | "Mulher & Beleza"
  | "Pet Shop & Cuidados"
  | "Fitness & Academia"
  | "Saúde & Bem-Estar"
  | "Criança & Bebê"
  | "Vestuário & Streetwear"
  | "Futebol & Artigos Esportivos"
  | "Tecnologia & Gadgets"
  | "Casa & Decoração"
  | "Joias & Luxo"
  | "Gamer & Setup"
  | "Automotivo & Ferramentas"
  | "Eletrônicos & Tech"
  | "Moda & Acessórios"
  | "Beleza & Cosméticos"
  | "Esportes & Fitness"
  | "Geral & Variedades";

export interface StoreColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
}

export type StoreSectionType =
  | "announcement"
  | "hero"
  | "benefits"
  | "featured_products"
  | "promo_banner"
  | "testimonials"
  | "newsletter"
  | "footer";

export interface StoreSection {
  id: string;
  type: StoreSectionType;
  title: string;
  enabled: boolean;
  content?: any;
}

export interface StorefrontStore {
  id: string;
  name: string;
  slug: string;
  niche: StoreNiche;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  status: "published" | "draft";
  ownerId?: string;
  ownerEmail?: string;
  colors: StoreColors;
  templateId?: string;
  sections: StoreSection[];
  assignedProductIds: string[];
  createdAt: string;
  updatedAt: string;
  metrics?: {
    visits: number;
    orders: number;
    revenue: number;
    conversionRate: number;
  };
}

export interface SupplierExportData {
  supplier: Supplier;
  exportedAt: string;
  totalProducts: number;
  products: Product[];
}

export interface Product {
  id: string;
  externalId: string;
  storeId: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  images: string[];
  url: string;
  sku: string | null;
  category: string | null;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface SyncResponse {
  success: boolean;
  syncRunId?: string;
  message?: string;
  results?: {
    productsFound: number;
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
    provider: string;
    duration: number;
    syncRunId?: string;
  };
}

export interface IngestionApiResponse {
  success: boolean;
  source?: string;
  shopId?: string;
  items?: any[];
  masterCatalog?: {
    total: number;
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
    storageProvider?: string;
    importDurationMs?: number;
  };
  metadata?: {
    totalFound?: number;
    executionTimeMs?: number;
    provider?: string;
    requestId?: string;
    syncRunId?: string;
  };
  errors?: string[];
}

export interface ApiError {
  error: string;
  message: string;
  syncRunId?: string;
}

export interface SyncRun {
  id: string;
  storeId: string;
  status: "running" | "success" | "partial" | "error";
  trigger: "manual" | "scheduled" | "webhook" | string;
  requestedLimit: number;
  discovered: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  durationMs: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface StoreOperationalStatus {
  success: boolean;
  store: Store;
  syncState: string;
  lastSync: string | null;
  lastSuccessfulSync: string | null;
  lastFailedSync: string | null;
  totalProducts: number;
  active: boolean;
  health: "healthy" | "syncing" | "degraded" | "error" | "never_synced";
  recentRuns: SyncRun[];
}
