import { AppError } from '../lib/errors/model';
import { logger } from '../lib/logging/logger';

export function handleApiError(error: any): Response {
  if (error && typeof error === 'object' && 'httpStatus' in error) {
    if (error.httpStatus >= 500) {
      logger.error('API AppError 5xx', { requestId: error.requestId }, {
        code: error.code,
        internalMessage: error.internalMessage,
        cause: error.cause
      });
    }

    return new Response(
      JSON.stringify(typeof error.toJSON === 'function' ? error.toJSON() : error),
      {
        status: error.httpStatus,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Handle generic / unknown errors
  console.error('Captured raw Unhandled API Error:', error);
  logger.error('Unhandled API Error', undefined, { 
    error: error instanceof Error ? error.message : String(error), 
    stack: error instanceof Error ? error.stack : undefined 
  });

  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        retryable: false
      }
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
