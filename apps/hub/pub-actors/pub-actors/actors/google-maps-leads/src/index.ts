import { z } from "zod";
import { PubGoogleMapsInput, PubGoogleMapsLead } from "./types.js";
import { PubActorDiagnostic, createInitialDiagnostic } from "../../../packages/actor-core/src/types.js";

/**
 * NormalizedLead Schema (Compatible with PUB LEADS core contract)
 */
export const NormalizedLeadSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().default("Brasil"),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  rating: z.number().nullable(),
  reviewsCount: z.number().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  sourceUrl: z.string().url(),
  sourcePlaceId: z.string().nullable(),
  rawData: z.record(z.any()),
  scrapedAt: z.string(),
});

export type NormalizedLead = z.infer<typeof NormalizedLeadSchema>;

export class PubGoogleMapsActor {
  static mapToNormalizedLead(raw: PubGoogleMapsLead, city = "Araruama", state = "RJ"): NormalizedLead {
    return {
      id: raw.placeId ? `gmaps:${raw.placeId}` : `gmaps:${encodeURIComponent(raw.name)}`,
      name: raw.name.trim(),
      category: raw.category || "Dentista",
      address: raw.address || `${city}, ${state}`,
      city: city,
      state: state,
      country: "Brasil",
      phone: raw.phone,
      website: raw.website,
      rating: raw.rating,
      reviewsCount: raw.reviewCount,
      latitude: raw.latitude,
      longitude: raw.longitude,
      sourceUrl: raw.googleMapsUrl,
      sourcePlaceId: raw.placeId,
      rawData: {
        rawName: raw.name,
        openingHours: raw.openingHours,
        plusCode: raw.plusCode,
      },
      scrapedAt: new Date().toISOString(),
    };
  }
}
