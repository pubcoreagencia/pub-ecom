import { z } from "zod";

/**
 * Standard Diagnostic Model for all PUB Scraper Core Actors
 */
export const PubActorDiagnosticSchema = z.object({
  success: z.boolean(),
  source: z.string(),
  sourceUrl: z.string(),
  extractionMethod: z.string(),
  statusCode: z.number().int(),
  finalUrl: z.string(),
  recordsFound: z.number().int().nonnegative(),
  recordsValid: z.number().int().nonnegative(),
  fieldsFound: z.array(z.string()),
  fieldsMissing: z.array(z.string()),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  durationMs: z.number().nonnegative(),
  error: z.string().nullable(),
});

export type PubActorDiagnostic = z.infer<typeof PubActorDiagnosticSchema>;

/**
 * Standard Base Input Interface
 */
export interface BaseActorInput {
  proxyConfiguration?: {
    useApifyProxy?: boolean;
    apifyProxyGroups?: string[];
    apifyProxyCountry?: string;
  };
  maxItems?: number;
}

/**
 * Standard Base Actor Result Envelope
 */
export interface PubActorResult<T = any> {
  data: T[];
  diagnostic: PubActorDiagnostic;
  metadata: {
    actorName: string;
    actorVersion: string;
    executedAt: string;
  };
}

/**
 * Helper to build empty/initial diagnostics
 */
export function createInitialDiagnostic(source: string, sourceUrl: string): PubActorDiagnostic {
  return {
    success: false,
    source,
    sourceUrl,
    extractionMethod: "uninitialized",
    statusCode: 0,
    finalUrl: sourceUrl,
    recordsFound: 0,
    recordsValid: 0,
    fieldsFound: [],
    fieldsMissing: [],
    blocked: false,
    blockReason: null,
    durationMs: 0,
    error: null,
  };
}
