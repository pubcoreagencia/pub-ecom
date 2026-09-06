/**
 * Structured Logger for PUB Actors
 * Automatically redacts sensitive tokens, credentials, and query params.
 */

const SENSITIVE_PATTERNS = [
  /apify_api_[A-Za-z0-9_-]+/gi,
  /Bearer\s+[A-Za-z0-9_.-]+/gi,
  /token=[A-Za-z0-9_.-]+/gi,
  /key=[A-Za-z0-9_.-]+/gi,
  /secret=[A-Za-z0-9_.-]+/gi,
  /password=[A-Za-z0-9_.-]+/gi,
];

export function redactSensitive(message: string): string {
  let cleaned = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[REDACTED_SECRET]");
  }
  return cleaned;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export class PubLogger {
  constructor(private context: string) {}

  private log(level: LogLevel, message: string, data?: Record<string, any>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message: redactSensitive(message),
      data: data ? JSON.parse(redactSensitive(JSON.stringify(data))) : undefined,
    };
    const serialized = JSON.stringify(entry);
    if (level === "error") {
      console.error(serialized);
    } else if (level === "warn") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(msg: string, data?: Record<string, any>) {
    this.log("debug", msg, data);
  }

  info(msg: string, data?: Record<string, any>) {
    this.log("info", msg, data);
  }

  warn(msg: string, data?: Record<string, any>) {
    this.log("warn", msg, data);
  }

  error(msg: string, data?: Record<string, any>) {
    this.log("error", msg, data);
  }
}
