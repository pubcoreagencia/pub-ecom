import { env } from '../config/env';
import { handleApiError } from './errors';
import { AppError } from '../lib/errors/model';

const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Authorization, Content-Type, x-guest-token, x-correlation-id';

export function withCors(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const origin = req.headers.get('origin');
      const allowedOrigins = env.server.ALLOWED_ORIGINS;

      let allowOrigin = '';
      if (origin && allowedOrigins.includes(origin)) {
        allowOrigin = origin;
      }

      // Preflight
      if (req.method === 'OPTIONS') {
        if (!allowOrigin) {
          // If not allowed, we don't send CORS headers, browser will block it
          return new Response(null, { status: 204 });
        }
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': allowOrigin,
            'Access-Control-Allow-Methods': ALLOWED_METHODS,
            'Access-Control-Allow-Headers': ALLOWED_HEADERS,
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin'
          }
        });
      }

      const response = await handler(req);
      
      if (allowOrigin) {
        response.headers.set('Access-Control-Allow-Origin', allowOrigin);
        response.headers.set('Vary', 'Origin');
      }

      return response;
    } catch (error) {
      const errorResponse = handleApiError(error);
      const origin = req.headers.get('origin');
      if (origin && env.server.ALLOWED_ORIGINS.includes(origin)) {
        errorResponse.headers.set('Access-Control-Allow-Origin', origin);
        errorResponse.headers.set('Vary', 'Origin');
      }
      return errorResponse;
    }
  };
}
