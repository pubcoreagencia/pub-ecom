export type UserRole = "MASTER" | "LOJISTA" | "FORNECEDOR" | "AFILIADO" | "INFLUENCER";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  created_at?: string;
}

export interface Store {
  id: string;
  name: string;
  ownerId: string;
  subdomain: string;
  status: "active" | "inactive";
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  created_at?: string;
}

export interface MasterProduct {
  id: string;
  supplierId: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  supplierCost: number;
  basePricePub: number;
  status: "active" | "inactive";
  isAvailable: boolean;
  metadata: Record<string, any> | null;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  cost: number; // For backward compatibility, represents basePricePub
  supplierId: string;
  storeId: string;
  stock: number;
  image?: string;
  masterProductId?: string;
  customName?: string;
  customDescription?: string;
  customImageUrl?: string;
  profitMargin?: number | undefined;
  status?: "active" | "inactive" | undefined;
  created_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at?: string;
}

export interface Order {
  id: string;
  external_id?: string | null;
  storeId: string;
  productId?: string | null; // Legacy compatibility
  supplierId?: string;
  customerId: string;
  influencerId?: string | null;
  affiliateId?: string | null;
  amount: number;
  cost: number;
  shipping: number;
  tax: number;
  discount: number;
  status:
    | "pending_payment"
    | "paid"
    | "processing"
    | "supplier_ordered"
    | "supplier_confirmed"
    | "shipped"
    | "in_transit"
    | "delivered"
    | "cancelled"
    | "refunded"
    | "payment_failed";
  fulfillmentStatus?: string;
  trackingCode?: string;
  paymentMethod?: string;
  financialMetadata?: Record<string, any>;
  net_profit?: number;
  createdAt: string;
}

export interface Commission {
  id: string;
  orderId: string;
  profileId: string;
  amount: number;
  type: "influencer" | "affiliate";
  status: "pending" | "paid";
  created_at: string;
}

export interface Wallet {
  id: string;
  profileId: string;
  balance: number;
  currency: string;
  updated_at?: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: "credit" | "debit";
  amount: number;
  description?: string;
  referenceId?: string;
  referenceType?: string;
  created_at: string;
}

export interface OrderTracking {
  id: string;
  orderId: string;
  status: string;
  message?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export type MarketingEventType =
  | "PAGE_VIEW"
  | "PRODUCT_VIEW"
  | "ADD_TO_CART"
  | "CHECKOUT_STARTED"
  | "PIX_CREATED"
  | "PIX_EXPIRED"
  | "PAYMENT_FAILED"
  | "PAYMENT_APPROVED"
  | "ORDER_CREATED"
  | "ORDER_PROCESSING"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "REFUND_CREATED";

export interface MarketingEvent {
  id: string;
  customerId: string;
  eventType: MarketingEventType;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface FinancialMetric {
  grossRevenue: number;
  productCost: number;
  shipping: number;
  paymentFees: number;
  discounts: number;
  netProfit: number;
  margin: number;
  affiliateCommission: number;
  influencerPayout: number;
  pubEcomNetResult: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  totalShipping: number;
  totalTax: number;
  totalDiscount: number;
  netProfit: number;
  pubResult: number;
  commissions: {
    influencers: number;
    afiliados: number;
  };
}

// Repository Interfaces for abstraction
export interface IOrderRepository {
  getAll(): Promise<Order[]>;
  getByStore(storeId: string): Promise<Order[]>;
  getByInfluencer(influencerId: string): Promise<Order[]>;
  create(order: Omit<Order, "id" | "createdAt">): Promise<Order>;
}

export interface IProductRepository {
  getAll(): Promise<Product[]>;
  getByStore(storeId: string): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
}

export interface IStoreRepository {
  getById(id: string): Promise<Store | null>;
  getByOwner(ownerId: string): Promise<Store[]>;
  getBySubdomain(subdomain: string): Promise<Store | null>;
}
