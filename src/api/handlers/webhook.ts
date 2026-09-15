import { PaymentHubService } from '../../services/payment_hub/service';
import { createAdminClient } from '../../lib/supabase/admin';
import { handleApiError } from '../errors';
import { AppError } from '../../lib/errors/model';
import { CredentialCipher } from '../../lib/crypto/credentials';

export async function handleWebhookRequest(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const path = url.pathname;

    // Format: /api/webhooks/payments/:providerId or /api/webhooks/payments/:providerId/:connectionId
    const match = path.match(/^\/api\/webhooks\/payments\/([^/?]+)(?:\/([^/?]+))?$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const providerId = match[1];
    let connectionId = match[2] ||
      url.searchParams.get('connection_id') ||
      url.searchParams.get('connectionId') ||
      req.headers.get('x-connection-id');

    // Extract headers (both lower-case and original case preserved)
    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
      headers[key] = val;
    });

    // Read raw body as text to preserve exact bytes for HMAC / signature verification
    const rawBody = await req.text();

    const adminDb = createAdminClient();

    // If connectionId not specified, lookup active connections for provider
    if (!connectionId) {
      const { data: connections, error: connErr } = await adminDb
        .from('gateway_connections')
        .select('id, webhook_secret_encrypted, is_global_default')
        .eq('provider_id', providerId)
        .eq('status', 'ACTIVE');

      if (connErr || !connections || connections.length === 0) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          publicMessage: 'Invalid gateway connection.',
          internalMessage: 'CONNECTION_NOT_FOUND: Connection not found or inactive',
          httpStatus: 404,
          retryable: false
        });
      }

      if (connections.length === 1) {
        connectionId = connections[0].id;
      } else {
        // Try matching token against encrypted webhook secrets
        const cipher = new CredentialCipher();
        const incomingToken = headers['asaas-access-token'] || headers['x-webhook-secret'] || '';
        let matched: string | null = null;
        for (const c of connections) {
          if (c.webhook_secret_encrypted) {
            try {
              const secret = cipher.decrypt(c.webhook_secret_encrypted);
              if (incomingToken && secret === incomingToken) {
                matched = c.id;
                break;
              }
            } catch {}
          }
        }
        connectionId = matched || connections.find(c => c.is_global_default)?.id || connections[0].id;
      }
    }

    const service = new PaymentHubService(adminDb);
    const result = await service.handleWebhook({
      providerId,
      connectionId,
      headers,
      rawBody
    });

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
