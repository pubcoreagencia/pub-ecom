import { z } from "zod";

export const PubShopeeProductInputSchema = z.object({
  url: z.string().url(),
  country: z.string().default("BR"),
  maxVariants: z.number().int().default(50),
});

export type PubShopeeProductInput = z.infer<typeof PubShopeeProductInputSchema>;

export const PubShopeeVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().nullable(),
  sku: z.string().nullable(),
  image: z.string().nullable(),
});

export type PubShopeeVariant = z.infer<typeof PubShopeeVariantSchema>;

export const PubShopeeProductSchema = z.object({
  source: z.literal("shopee"),
  sourceUrl: z.string().url(),
  shopId: z.string(),
  itemId: z.string(),
  title: z.string().min(1),
  description: z.string().nullable(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().nullable(),
  currency: z.literal("BRL"),
  images: z.array(z.string().url()).min(1),
  thumbnail: z.string().url().nullable(),
  variants: z.array(PubShopeeVariantSchema),
  sku: z.string().nullable(),
  stock: z.number().int().nonnegative().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  soldCount: z.number().int().nonnegative().nullable(),
  category: z.string().nullable(),
  attributes: z.record(z.any()).optional(),
  extractionLevel: z.enum(["level1_html", "level2_api", "level3_dom", "level4_stealth", "level5_residential"]),
  scrapedAt: z.string(),
});

export type PubShopeeProduct = z.infer<typeof PubShopeeProductSchema>;
