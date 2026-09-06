import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { orderRepository } from "./repositories/orderRepository";
import { Order } from "@/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string(),
        customerId: z.string(),
        productId: z.string().optional(),
        amount: z.number(),
        cost: z.number().optional(),
        shipping: z.number().default(0),
        tax: z.number().default(0),
        discount: z.number().default(0),
        influencerId: z.string().optional(),
        affiliateId: z.string().optional(),
        external_id: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId;

    // Verify caller is owner of the store or MASTER
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, owner_id")
      .eq("id", data.storeId)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    const isMaster = profile?.role === "MASTER";
    const isOwner = store?.owner_id === userId;

    if (!isMaster && !isOwner) {
      throw new Error("Forbidden: Usuário não tem permissão para criar pedidos nesta loja.");
    }

    const order = await orderRepository.create({
      storeId: data.storeId,
      customerId: data.customerId,
      productId: data.productId ?? null,
      amount: data.amount,
      cost: data.cost ?? 0,
      shipping: data.shipping,
      tax: data.tax,
      discount: data.discount,
      status: "paid",
      influencerId: data.influencerId ?? null,
      affiliateId: data.affiliateId ?? null,
      external_id: data.external_id ?? null,
    });

    return order;
  });

export const getOrdersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().optional(),
        influencerId: z.string().optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    const isMaster = profile?.role === "MASTER";

    if (data?.storeId) {
      // Must be store owner or MASTER
      const { data: store } = await supabase
        .from("stores")
        .select("id, owner_id")
        .eq("id", data.storeId)
        .single();

      if (!isMaster && store?.owner_id !== userId) {
        throw new Error("Forbidden: Acesso negado aos pedidos desta loja.");
      }
      return await orderRepository.getByStore(data.storeId);
    }

    if (data?.influencerId) {
      // Must be the influencer themselves or MASTER
      if (!isMaster && data.influencerId !== userId) {
        throw new Error("Forbidden: Influenciador só pode consultar seus próprios pedidos.");
      }
      return await orderRepository.getByInfluencer(data.influencerId);
    }

    // Global order list is strictly restricted to MASTER
    if (!isMaster) {
      throw new Error("Forbidden: Consulta global de pedidos restrita a administradores MASTER.");
    }

    return await orderRepository.getAll();
  });
