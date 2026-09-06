import { Order, IOrderRepository } from "@/types";
import { mockOrders } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";

export class OrderRepository implements IOrderRepository {
  private useMock = true; // Toggle for easy migration

  async getAll(): Promise<Order[]> {
    if (this.useMock) {
      return [...mockOrders];
    }

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, external_id, store_id, customer_id, influencer_id, affiliate_id, amount, cost, shipping, tax, discount, status, fulfillment_status, tracking_code, payment_method, financial_metadata, net_profit, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapDbOrderToType);
  }

  async getByStore(storeId: string): Promise<Order[]> {
    if (this.useMock) {
      return mockOrders.filter((o: Order) => o.storeId === storeId);
    }

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, external_id, store_id, customer_id, influencer_id, affiliate_id, amount, cost, shipping, tax, discount, status, fulfillment_status, tracking_code, payment_method, financial_metadata, net_profit, created_at",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapDbOrderToType);
  }

  /**
   * Influencer order query: queries the secure influencer_orders view, strictly omitting store cost and net_profit
   */
  async getByInfluencer(influencerId: string): Promise<Order[]> {
    if (this.useMock) {
      return mockOrders
        .filter((o: Order) => o.influencerId === influencerId)
        .map((o) => {
          const { cost, net_profit, financialMetadata, ...safeOrder } = o;
          return {
            ...safeOrder,
            cost: 0,
          };
        });
    }

    const { data, error } = await (supabase.from("influencer_orders" as any) as any)
      .select(
        "id, external_id, store_id, customer_id, influencer_id, affiliate_id, amount, shipping, tax, discount, status, fulfillment_status, tracking_code, created_at" as any,
      )
      .eq("influencer_id" as any, influencerId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      external_id: row.external_id ?? undefined,
      storeId: row.store_id,
      customerId: row.customer_id,
      influencerId: row.influencer_id ?? undefined,
      affiliateId: row.affiliate_id ?? undefined,
      amount: Number(row.amount),
      cost: 0, // Stripped for influencer
      shipping: Number(row.shipping || 0),
      tax: Number(row.tax || 0),
      discount: Number(row.discount || 0),
      status: row.status as any,
      fulfillmentStatus: row.fulfillment_status ?? undefined,
      trackingCode: row.tracking_code ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async create(order: Omit<Order, "id" | "createdAt">): Promise<Order> {
    if (this.useMock) {
      const newOrder: Order = {
        ...order,
        id: `MOCK-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      };
      return newOrder;
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({
        external_id: order.external_id ?? null,
        store_id: order.storeId,
        customer_id: order.customerId,
        influencer_id: order.influencerId ?? null,
        affiliate_id: order.affiliateId ?? null,
        amount: order.amount,
        cost: order.cost,
        shipping: order.shipping,
        tax: order.tax,
        discount: order.discount,
        status: order.status,
      })
      .select(
        "id, external_id, store_id, customer_id, influencer_id, affiliate_id, amount, cost, shipping, tax, discount, status, fulfillment_status, tracking_code, payment_method, financial_metadata, net_profit, created_at",
      )
      .single();

    if (error) throw error;
    return this.mapDbOrderToType(data);
  }

  private mapDbOrderToType(dbOrder: any): Order {
    return {
      id: dbOrder.id,
      external_id: dbOrder.external_id ?? undefined,
      storeId: dbOrder.store_id,
      customerId: dbOrder.customer_id,
      influencerId: dbOrder.influencer_id ?? undefined,
      affiliateId: dbOrder.affiliate_id ?? undefined,
      amount: Number(dbOrder.amount),
      cost: Number(dbOrder.cost),
      shipping: Number(dbOrder.shipping),
      tax: Number(dbOrder.tax),
      discount: Number(dbOrder.discount),
      status: dbOrder.status as any,
      fulfillmentStatus: dbOrder.fulfillment_status ?? undefined,
      trackingCode: dbOrder.tracking_code ?? undefined,
      paymentMethod: dbOrder.payment_method ?? undefined,
      financialMetadata: dbOrder.financial_metadata ?? undefined,
      net_profit: Number(dbOrder.net_profit),
      createdAt: dbOrder.created_at,
    };
  }
}

export const orderRepository = new OrderRepository();
