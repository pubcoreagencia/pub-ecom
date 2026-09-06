import { z } from "zod";
import { PubActorDiagnosticSchema } from "../../packages/actor-core/src/types.js";

export const PubShopeeStoreInputSchema = z.object({
  url: z.string().url(),
  country: z.string().default("BR"),
  maxProducts: z.number().int().min(1).max(500).default(50),
});

export type PubShopeeStoreInput = z.infer<typeof PubShopeeStoreInputSchema>;

export const PubShopeeProductCandidateSchema = z.object({
  shopId: z.string(),
  itemId: z.string(),
  url: z.string().url(),
  title: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  image: z.string().url().nullable().optional(),
});

export type PubShopeeProductCandidate = z.infer<typeof PubShopeeProductCandidateSchema>;

export const PubShopeeStoreDiscoveryResultSchema = z.object({
  source: z.literal("shopee"),
  storeUrl: z.string().url(),
  username: z.string().nullable(),
  shopId: z.string().nullable(),
  totalDiscovered: z.number().int().nonnegative(),
  products: z.array(PubShopeeProductCandidateSchema),
  diagnostic: PubActorDiagnosticSchema,
  discoveredAt: z.string(),
});

export type PubShopeeStoreDiscoveryResult = z.infer<typeof PubShopeeStoreDiscoveryResultSchema>;
