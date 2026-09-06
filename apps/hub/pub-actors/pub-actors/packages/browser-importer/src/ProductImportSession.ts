export type ImportSessionState =
  | "IDLE"
  | "DETECTING"
  | "COLLECTING"
  | "NORMALIZING"
  | "VALIDATING"
  | "PREVIEW_READY"
  | "EXPORT_READY"
  | "BLOCKED"
  | "INCOMPLETE"
  | "INVALID"
  | "FAILED";

export interface SessionMetrics {
  connectionMs: number;
  collectionMs: number;
  normalizationMs: number;
  validationMs: number;
  previewMs: number;
  payloadGenerationMs: number;
  totalMs: number;
}

export class ProductImportSession {
  readonly sessionId: string;
  readonly createdAt: string;
  state: ImportSessionState = "IDLE";
  marketplace: string | null = null;
  sourceUrl: string | null = null;
  metrics: SessionMetrics = {
    connectionMs: 0,
    collectionMs: 0,
    normalizationMs: 0,
    validationMs: 0,
    previewMs: 0,
    payloadGenerationMs: 0,
    totalMs: 0,
  };
  errors: string[] = [];
  warnings: string[] = [];

  constructor() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.createdAt = new Date().toISOString();
  }

  transitionTo(nextState: ImportSessionState): void {
    this.state = nextState;
  }

  recordError(error: string): void {
    this.errors.push(error);
    this.state = "FAILED";
  }

  recordWarning(warning: string): void {
    this.warnings.push(warning);
  }
}
