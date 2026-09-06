import { User, Store, Supplier, Product, Order } from "@/types";

export const mockUsers: User[] = [
  { id: "u1", name: "Admin Master", role: "MASTER", email: "master@pubecom.com" },
  { id: "u2", name: "Lojista VIP", role: "LOJISTA", email: "lojista@loja.com" },
  { id: "u3", name: "Influencer Prime", role: "INFLUENCER", email: "influencer@social.com" },
];

export const mockStores: Store[] = [
  { id: "s1", name: "Trend Store", ownerId: "u2", subdomain: "trend", status: "active" },
  { id: "s2", name: "Electro Hub", ownerId: "u2", subdomain: "electro", status: "active" },
];

export const mockSuppliers: Supplier[] = [
  { id: "sup1", name: "FastShip Logistics", category: "General" },
  { id: "sup2", name: "Tech Source Pro", category: "Electronics" },
];

export const mockProducts: Product[] = [
  {
    id: "p1",
    name: "Premium Wireless Headphones",
    price: 899.9,
    cost: 450.0,
    supplierId: "sup2",
    storeId: "s1",
    stock: 150,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
  },
  {
    id: "p2",
    name: "Smart Fitness Watch",
    price: 459.0,
    cost: 210.0,
    supplierId: "sup2",
    storeId: "s1",
    stock: 85,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
  },
];

export const mockOrders: Order[] = [
  {
    id: "B1001",
    storeId: "s1",
    productId: "p1",
    supplierId: "sup2",
    customerId: "c1",
    influencerId: "u3",
    amount: 899.9,
    cost: 450.0,
    shipping: 25.0,
    tax: 45.0,
    discount: 0,
    status: "delivered",
    createdAt: "2026-08-20T10:00:00Z",
  },
  {
    id: "B1002",
    storeId: "s1",
    productId: "p2",
    supplierId: "sup2",
    customerId: "c2",
    amount: 459.0,
    cost: 210.0,
    shipping: 15.0,
    tax: 22.95,
    discount: 10.0,
    status: "paid",
    createdAt: "2026-08-21T09:30:00Z",
  },
];
