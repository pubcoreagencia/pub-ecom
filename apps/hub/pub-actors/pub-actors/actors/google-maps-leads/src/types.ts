import { z } from "zod";

export const GoogleMapsQueryItemSchema = z.object({
  query: z.string().trim().min(2),
  location: z.string().trim().min(2),
  maxResults: z.number().int().min(1).max(200).default(50),
});

export const PubGoogleMapsInputSchema = z.object({
  query: z.string().trim().min(2).optional(),
  location: z.string().trim().min(2).optional(),
  maxResults: z.number().int().min(1).max(200).optional(),
  queries: z.array(GoogleMapsQueryItemSchema).optional(),
  language: z.string().default("pt-BR"),
  country: z.string().default("BR"),
});

export type PubGoogleMapsInput = z.infer<typeof PubGoogleMapsInputSchema>;

export const PubGoogleMapsLeadSchema = z.object({
  name: z.string(),
  category: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().int().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  googleMapsUrl: z.string(),
  placeId: z.string().nullable(),
  openingHours: z.array(z.string()).nullable(),
  plusCode: z.string().nullable(),
  metadata: z.record(z.any()).optional(),
});

export type PubGoogleMapsLead = z.infer<typeof PubGoogleMapsLeadSchema>;
