export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  storeId?: string;
  customerId?: string;
  cartId?: string;
  checkoutId?: string;
  orderId?: string;
  paymentId?: string;
}

export interface Logger {
  debug(message: string, context?: LogContext, data?: Record<string, unknown>): void;
  info(message: string, context?: LogContext, data?: Record<string, unknown>): void;
  warn(message: string, context?: LogContext, data?: Record<string, unknown>): void;
  error(message: string, context?: LogContext, data?: Record<string, unknown>): void;
}

export class StructuredLogger implements Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext, data?: Record<string, unknown>) {
    // Strip sensitive keys from data if any exist accidentally
    const sanitizedData = this.sanitize(data);

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data: sanitizedData
    });
  }

  private sanitize(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    
    const sensitiveKeys = ['password', 'token', 'accesstoken', 'refreshtoken', 'authorization', 'service_role', 'api_key', 'apikey', 'secret', 'credential'];
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }
    
    if (typeof data === 'object') {
      const sanitized = { ...data } as Record<string, unknown>;
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitize(sanitized[key]);
        }
      }
      return sanitized;
    }
    
    return data;
  }

  debug(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    console.debug(this.formatLog('DEBUG', message, context, data));
  }

  info(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    console.info(this.formatLog('INFO', message, context, data));
  }

  warn(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    console.warn(this.formatLog('WARN', message, context, data));
  }

  error(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    console.error(this.formatLog('ERROR', message, context, data));
  }
}

export const logger = new StructuredLogger();
