/**
 * Webhook API – Receives real-time catalog events from external sources
 * (Shopee, Mercado Livre, internal POS, etc.) and pushes them into the
 * catalog sync pipeline. Emits structured events to downstream workers
 * and stores delivery audit records.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { publishCatalogEvent } from '../events/eventBus';
import { recordWebhookDelivery } from '../repositories/webhookRepository';

const router = Router();

const SUPPORTED_SOURCES = new Set(['shopee', 'mercadolivre', 'internal_pos', 'erp']);
const SUPPORTED_EVENT_TYPES = new Set([
  'product.created',
  'product.updated',
  'product.deleted',
  'stock.changed',
  'price.changed',
]);

interface WebhookPayload {
  source: string;
  eventType: string;
  externalId: string;
  storeId: string;
  data: Record<string, unknown>;
  occurredAt?: string;
}

function verifySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

function validatePayload(body: unknown): { ok: true; payload: WebhookPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' };
  const b = body as Record<string, unknown>;

  if (typeof b.source !== 'string' || !SUPPORTED_SOURCES.has(b.source)) {
    return { ok: false, error: `Invalid or unsupported source. Allowed: ${[...SUPPORTED_SOURCES].join(', ')}` };
  }
  if (typeof b.eventType !== 'string' || !SUPPORTED_EVENT_TYPES.has(b.eventType)) {
    return { ok: false, error: `Invalid or unsupported eventType. Allowed: ${[...SUPPORTED_EVENT_TYPES].join(', ')}` };
  }
  if (typeof b.externalId !== 'string' || b.externalId.length === 0) {
    return { ok: false, error: 'externalId is required (string)' };
  }
  if (typeof b.storeId !== 'string' || b.storeId.length === 0) {
    return { ok: false, error: 'storeId is required (string)' };
  }
  if (typeof b.data !== 'object' || b.data === null) {
    return { ok: false, error: 'data must be an object' };
  }

  return {
    ok: true,
    payload: {
      source: b.source,
      eventType: b.eventType,
      externalId: b.externalId,
      storeId: b.storeId,
      data: b.data as Record<string, unknown>,
      occurredAt: typeof b.occurredAt === 'string' ? b.occurredAt : new Date().toISOString(),
    },
  };
}

router.post('/webhooks/catalog', async (req: Request, res: Response) => {
  const start = Date.now();
  const rawBody = JSON.stringify(req.body);
  const signature = req.header('x-webhook-signature');
  const secret = process.env.WEBHOOK_SECRET || '';

  if (secret && !verifySignature(rawBody, signature, secret)) {
    logger.warn('Webhook rejected: invalid signature', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const validation = validatePayload(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const payload = validation.payload;
  const deliveryId = crypto.randomUUID();

  try {
    await recordWebhookDelivery({
      deliveryId,
      source: payload.source,
      eventType: payload.eventType,
      externalId: payload.externalId,
      storeId: payload.storeId,
      payload: payload.data,
      occurredAt: payload.occurredAt!,
      receivedAt: new Date().toISOString(),
      status: 'accepted',
    });

    await publishCatalogEvent({
      deliveryId,
      source: payload.source,
      eventType: payload.eventType,
      externalId: payload.externalId,
      storeId: payload.storeId,
      data: payload.data,
      occurredAt: payload.occurredAt,
    });

    logger.info('Webhook accepted', {
      deliveryId,
      source: payload.source,
      eventType: payload.eventType,
      durationMs: Date.now() - start,
    });

    res.status(202).json({ accepted: true, deliveryId });
  } catch (err) {
    logger.error('Webhook processing failed', {
      deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal processing failure', deliveryId });
  }
});

router.get('/webhooks/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    supportedSources: [...SUPPORTED_SOURCES],
    supportedEventTypes: [...SUPPORTED_EVENT_TYPES],
    signatureRequired: Boolean(process.env.WEBHOOK_SECRET),
  });
});

export default router;
