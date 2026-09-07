import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getRedisClient } from '../infra/redisClient';

/**
 * Health API — provides liveness and readiness probes for the catalog-worker.
 *
 * - GET /health/live   -> process is alive (no dependency checks)
 * - GET /health/ready  -> checks Postgres + Redis + queue depth thresholds
 * - GET /health/startup -> long-startup probe (waits for migrations / seed)
 *
 * Designed to be consumed by Kubernetes, load balancers, and the PUB CORE
 * observability stack. Never throws — always returns a structured JSON payload.
 */

export interface HealthDeps {
  pool: Pool;
  redisUrl: string;
  queueName?: string;
  maxQueueDepth?: number;
  maxDbLatencyMs?: number;
  maxRedisLatencyMs?: number;
}

interface ProbeResult {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  error?: string;
}

interface ReadinessReport {
  status: 'up' | 'down' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  commit?: string;
  checks: {
    postgres: ProbeResult;
    redis: ProbeResult;
    queue?: ProbeResult;
  };
}

const SERVICE_START_TS = Date.now();
const SERVICE_VERSION = process.env.SERVICE_VERSION || '0.0.0';
const SERVICE_COMMIT = process.env.GIT_COMMIT_SHA || process.env.COMMIT_SHA;

export function buildHealthRouter(deps: HealthDeps): Router {
  const router = Router();
  const maxDbLatency = deps.maxDbLatencyMs ?? 500;
  const maxRedisLatency = deps.maxRedisLatencyMs ?? 250;
  const maxQueueDepth = deps.maxQueueDepth ?? 10_000;

  // -------- Liveness: cheap, no I/O --------
  router.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'up',
      service: 'catalog-worker',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - SERVICE_START_TS) / 1000),
    });
  });

  // -------- Readiness: full dependency probe --------
  router.get('/health/ready', async (_req: Request, res: Response) => {
    const report = await runReadiness(deps, { maxDbLatency, maxRedisLatency, maxQueueDepth });
    const httpCode = report.status === 'down' ? 503 : 200;
    res.status(httpCode).json(report);
  });

  // -------- Startup: alias for slow-boot probes --------
  router.get('/health/startup', async (_req: Request, res: Response) => {
    const report = await runReadiness(deps, { maxDbLatency, maxRedisLatency, maxQueueDepth });
    // During startup, "degraded" is acceptable (still warming up).
    const httpCode = report.status === 'down' ? 503 : 200;
    res.status(httpCode).json(report);
  });

  return router;
}

async function runReadiness(
  deps: HealthDeps,
  thresholds: { maxDbLatency: number; maxRedisLatency: number; maxQueueDepth: number }
): Promise<ReadinessReport> {
  const [postgres, redis] = await Promise.all([
    probePostgres(deps.pool, thresholds.maxDbLatency),
    probeRedis(deps.redisUrl, thresholds.maxRedisLatency),
  ]);

  let queue: ProbeResult | undefined;
  if (deps.queueName) {
    queue = await probeQueueDepth(deps.queueName, thresholds.maxQueueDepth);
  }

  let aggregate: ReadinessReport['status'] = 'up';
  if (postgres.status === 'down' || redis.status === 'down' || queue?.status === 'down') {
    aggregate = 'down';
  } else if (
    postgres.status === 'degraded' ||
    redis.status === 'degraded' ||
    queue?.status === 'degraded'
  ) {
    aggregate = 'degraded';
  }

  return {
    status: aggregate,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - SERVICE_START_TS) / 1000),
    version: SERVICE_VERSION,
    commit: SERVICE_COMMIT,
    checks: { postgres, redis, queue },
  };
}

async function probePostgres(pool: Pool, maxLatencyMs: number): Promise<ProbeResult> {
  const started = Date.now();
  try {
    // Lightweight query: SELECT 1 with a tight timeout.
    const result = await Promise.race([
      pool.query('SELECT 1 AS ok'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('postgres-timeout')), maxLatencyMs * 2)
      ),
    ]);
    const latencyMs = Date.now() - started;
    if (!result || result.rowCount !== 1) {
      return { status: 'down', latencyMs, error: 'unexpected-payload' };
    }
    return {
      status: latencyMs > maxLatencyMs ? 'degraded' : 'up',
      latencyMs,
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeRedis(redisUrl: string, maxLatencyMs: number): Promise<ProbeResult> {
  const started = Date.now();
  let client: ReturnType<typeof getRedisClient> | null = null;
  try {
    client = getRedisClient(redisUrl);
    const pong = await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('redis-timeout')), maxLatencyMs * 2)
      ),
    ]);
    const latencyMs = Date.now() - started;
    if (pong !== 'PONG') {
      return { status: 'down', latencyMs, error: 'no-pong' };
    }
    return {
      status: latencyMs > maxLatencyMs ? 'degraded' : 'up',
      latencyMs,
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // We deliberately do not close the shared client here.
    if (client && typeof (client as { disconnect?: () => void }).disconnect === 'function') {
      try {
        (client as { disconnect?: () => void }).disconnect?.();
      } catch {
        /* ignore */
      }
    }
  }
}

async function probeQueueDepth(queueName: string, maxDepth: number): Promise<ProbeResult> {
  const started = Date.now();
  try {
    // We rely on Redis-backed BullMQ/Bull style queues; LLEN gives O(1) depth.
    const client = getRedisClient(process.env.REDIS_URL || 'redis://localhost:6379');
    const depth = await client.llen(`bull:${queueName}:wait`);
    const latencyMs = Date.now() - started;
    return {
      status: depth > maxDepth ? 'degraded' : 'up',
      latencyMs,
      // surface depth for ops dashboards
      ...(depth > maxDepth ? { error: `queue-depth=${depth}>${maxDepth}` } : {}),
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Helper: middleware-style readiness for graceful shutdown.
 * Returns true if the worker should keep accepting traffic.
 */
export async function isReady(deps: HealthDeps): Promise<boolean> {
  const report = await runReadiness(deps, {
    maxDbLatency: deps.maxDbLatencyMs ?? 500,
    maxRedisLatency: deps.maxRedisLatencyMs ?? 250,
    maxQueueDepth: deps.maxQueueDepth ?? 10_000,
  });
  return report.status !== 'down';
}
