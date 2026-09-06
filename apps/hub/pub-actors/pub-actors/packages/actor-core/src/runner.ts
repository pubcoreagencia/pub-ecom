import { z } from "zod";
import { PubActorDiagnostic, PubActorResult, createInitialDiagnostic } from "./types.js";
import { PubLogger } from "./logger.js";

export interface FieldValidationResult {
  fieldsFound: string[];
  fieldsMissing: string[];
  isValid: boolean;
}

/**
 * Validates a single record against expected required and optional fields
 */
export function inspectRecordFields(
  record: Record<string, any>,
  requiredFields: string[],
  optionalFields: string[] = []
): FieldValidationResult {
  const fieldsFound: string[] = [];
  const fieldsMissing: string[] = [];

  const allExpected = [...requiredFields, ...optionalFields];

  for (const field of allExpected) {
    const val = record[field];
    if (val !== undefined && val !== null && val !== "") {
      fieldsFound.push(field);
    } else if (requiredFields.includes(field)) {
      fieldsMissing.push(field);
    }
  }

  return {
    fieldsFound,
    fieldsMissing,
    isValid: fieldsMissing.length === 0,
  };
}

/**
 * Base Abstract Class for all PUB Actors
 */
export abstract class BasePubActor<TInput extends Record<string, any>, TOutput> {
  protected logger: PubLogger;

  constructor(
    public readonly name: string,
    public readonly version: string = "1.0.0",
    public readonly source: string
  ) {
    this.logger = new PubLogger(name);
  }

  /**
   * Abstract execution handler to be implemented by specific scrapers
   */
  abstract executeInternal(
    input: TInput,
    diagnostic: PubActorDiagnostic
  ): Promise<{ data: TOutput[]; diagnostic: PubActorDiagnostic }>;

  /**
   * Public Entrypoint with standardized lifecycle, timing, validation, and error boundaries
   */
  async run(rawInput: unknown): Promise<PubActorResult<TOutput>> {
    const startTime = Date.now();
    const sourceUrl = (rawInput as any)?.url || (rawInput as any)?.query || "unknown";
    const diagnostic = createInitialDiagnostic(this.source, sourceUrl);

    this.logger.info(`Starting execution of ${this.name} v${this.version}`, { source: this.source, sourceUrl });

    try {
      // 1. Validate Input
      const input = this.validateInput(rawInput);

      // 2. Execute Internal Scraper Logic
      const { data, diagnostic: updatedDiagnostic } = await this.executeInternal(input, diagnostic);

      // 3. Finalize Metrics
      const durationMs = Date.now() - startTime;
      updatedDiagnostic.durationMs = durationMs;
      updatedDiagnostic.recordsFound = data.length;
      updatedDiagnostic.recordsValid = data.filter((item) => !this.isMockOrInvalid(item)).length;
      updatedDiagnostic.success = !updatedDiagnostic.blocked && updatedDiagnostic.recordsValid > 0 && !updatedDiagnostic.error;

      this.logger.info(`Execution completed for ${this.name}`, {
        success: updatedDiagnostic.success,
        recordsFound: updatedDiagnostic.recordsFound,
        recordsValid: updatedDiagnostic.recordsValid,
        durationMs,
      });

      return {
        data,
        diagnostic: updatedDiagnostic,
        metadata: {
          actorName: this.name,
          actorVersion: this.version,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      diagnostic.durationMs = durationMs;
      diagnostic.success = false;
      diagnostic.error = err.message || String(err);

      this.logger.error(`Execution failed for ${this.name}: ${diagnostic.error}`, { stack: err.stack });

      return {
        data: [],
        diagnostic,
        metadata: {
          actorName: this.name,
          actorVersion: this.version,
          executedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Hook to validate input schema
   */
  abstract validateInput(rawInput: unknown): TInput;

  /**
   * Hook to identify and reject mock or synthetic data
   */
  abstract isMockOrInvalid(item: TOutput): boolean;
}
