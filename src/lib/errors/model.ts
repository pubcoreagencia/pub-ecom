export type AppErrorCode = 
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'TENANT_ACCESS_ERROR'
  | 'VALIDATION_ERROR'
  | 'OUT_OF_STOCK'
  | 'CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PAYMENT_ERROR'
  | 'SHIPPING_ERROR'
  | 'INTERNAL_ERROR';

export interface AppErrorOptions {
  code: AppErrorCode;
  publicMessage: string;
  internalMessage: string;
  httpStatus: number;
  retryable: boolean;
  requestId?: string;
  correlationId?: string;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly publicMessage: string;
  public readonly internalMessage: string;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly requestId?: string;
  public readonly correlationId?: string;
  public readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.internalMessage);
    this.name = 'AppError';
    this.code = options.code;
    this.publicMessage = options.publicMessage;
    this.internalMessage = options.internalMessage;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable;
    this.requestId = options.requestId;
    this.correlationId = options.correlationId;
    this.cause = options.cause;
  }

  // Prevents internal leaks by returning a safe serialized object
  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.publicMessage,
        requestId: this.requestId,
        retryable: this.retryable
      }
    };
  }
}
