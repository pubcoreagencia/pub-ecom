import { z } from "zod";
import { PubEcomProduct, PubEcomProductSchema } from "../../../actor-core/src/canonical.js";
import { StrategyExecutionResult } from "../../../actor-core/src/strategies.js";

export const ImportJobStateSchema = z.enum([
  "queued",
  "detecting",
  "extracting",
  "normalizing",
  "validating",
  "preview",
  "importing",
  "completed",
  "failed",
  "blocked",
]);

export type ImportJobState = z.infer<typeof ImportJobStateSchema>;

export interface ImportJobLog {
  timestamp: string;
  state: ImportJobState;
  message: string;
}

export interface ImportJobData {
  id: string;
  url: string;
  targetPlatform?: "shopify" | "nuvemshop";
  targetStoreId?: string;
  state: ImportJobState;
  source?: string;
  product?: PubEcomProduct;
  diagnostic?: StrategyExecutionResult;
  error?: string;
  logs: ImportJobLog[];
  createdAt: string;
  updatedAt: string;
}

export class ImportJob {
  private data: ImportJobData;

  constructor(id: string, url: string, targetPlatform?: "shopify" | "nuvemshop", targetStoreId?: string) {
    const now = new Date().toISOString();
    this.data = {
      id,
      url,
      targetPlatform,
      targetStoreId,
      state: "queued",
      logs: [{ timestamp: now, state: "queued", message: "Import job initialized and queued" }],
      createdAt: now,
      updatedAt: now,
    };
  }

  getState(): ImportJobState {
    return this.data.state;
  }

  getData(): ImportJobData {
    return { ...this.data };
  }

  transitionTo(newState: ImportJobState, message: string): void {
    const validTransitions: Record<ImportJobState, ImportJobState[]> = {
      queued: ["detecting", "failed"],
      detecting: ["extracting", "failed", "blocked"],
      extracting: ["normalizing", "failed", "blocked"],
      normalizing: ["validating", "failed"],
      validating: ["preview", "failed"],
      preview: ["importing", "failed", "completed"],
      importing: ["completed", "failed"],
      completed: [],
      failed: [],
      blocked: [],
    };

    const allowed = validTransitions[this.data.state];
    if (!allowed.includes(newState)) {
      throw new Error(`Invalid state transition from ${this.data.state} to ${newState}`);
    }

    this.data.state = newState;
    this.data.updatedAt = new Date().toISOString();
    this.data.logs.push({
      timestamp: this.data.updatedAt,
      state: newState,
      message,
    });
  }

  setProduct(product: PubEcomProduct): void {
    this.data.product = product;
  }

  setDiagnostic(diag: StrategyExecutionResult): void {
    this.data.diagnostic = diag;
  }

  setError(error: string): void {
    this.data.error = error;
  }
}
