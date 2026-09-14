// tests/services/payment_hub/external_identity_resolver.test.ts
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import { ExternalCustomerResolver } from '../../src/services/payment_hub/external_identity_resolver';
import { PaymentProvider } from '../../src/services/payment_hub/types';
import { AppError } from '../../src/lib/errors/model';

const supabaseUrl = 'http://127.0.0.1:54321';
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
if (!serviceRoleKey) {
  const { execSync } = require('child_process');
  const statusStr = execSync('npx supabase status -o json').toString();
  const jsonStr = statusStr.substring(statusStr.indexOf('{'));
  const status = JSON.parse(jsonStr);
  serviceRoleKey = status.SERVICE_ROLE_KEY;
}

const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function makeMockProvider(opts?: {
  reconcileResult?: string | null;
  createDelayMs?: number;
  createShouldFail?: boolean;
}) {
  let createCalls = 0;
  let reconcileCalls = 0;
  const createdIds: string[] = [];
  const provider: PaymentProvider = {
    providerId: 'resolver_test_provider',
    createPayment: async () => ({ providerPaymentId: '', rawResponse: {} }),
    getPayment: async () => ({ providerPaymentId: '', status: 'PAID', rawResponse: {} }),
    verifyWebhook: async () => ({ eventId: '', eventType: '' }),
    normalizeStatus: () => 'PAID',
    capabilities: {
      async createExternalCustomer({ connectionId, normalizedCustomer, idempotencyKey }) {
        createCalls++;
        if (opts?.createShouldFail) {
          throw new Error('external creation failed');
        }
        if (opts?.createDelayMs) {
          await new Promise(r => setTimeout(r, opts.createDelayMs));
        }
        const extId = `ext-${connectionId}`;
        createdIds.push(extId);
        (global as any).__lastIdempotencyKey = idempotencyKey;
        return { externalId: extId, metadata: { source: 'mock' } };
      },
      async reconcileExternalCustomer({ customerId, connectionId, normalizedCustomer }) {
        reconcileCalls++;
        return opts?.reconcileResult ?? null;
      },
    },
  } as any;
  (provider as any).__counters = { createCalls, reconcileCalls, createdIds };
  return provider as PaymentProvider & { __counters: any };
}

async function cleanTables() {
  await client.from('customer_gateway_identities').delete();
  await client.from('gateway_connections').delete();
  await client.from('gateway_providers').delete();
  await client.from('customers').delete();
}

async function insertProviderAndConnection() {
  const { data: provider } = await client.from('gateway_providers').insert({
    provider_id: 'resolver_test_provider',
    name: 'Resolver Test',
    environment: 'SANDBOX',
    is_active: true,
    config: {},
  }).single();
  const { data: conn } = await client.from('gateway_connections').insert({
    provider_id: 'resolver_test_provider',
    environment: 'SANDBOX',
    is_global_default: true,
    status: 'ACTIVE',
    encrypted_credentials: '{}',
    webhook_secret_encrypted: '{}',
    public_key: 'test',
  }).single();
  return conn;
}

describe('ExternalCustomerResolver unit tests', () => {
  let resolver: ExternalCustomerResolver;
  let connection: any;
  beforeAll(async () => {
    await cleanTables();
    connection = await insertProviderAndConnection();
    resolver = new ExternalCustomerResolver(client);
  });
  afterEach(async () => {
    await client.from('customer_gateway_identities').delete();
  });
  test('ACTIVE: returns existing external ID without calling capabilities', async () => {
    const provider = makeMockProvider();
    await client.from('customer_gateway_identities').insert({
      customer_id: 'cust-1',
      connection_id: connection.id,
      external_customer_id: 'existing-id',
      status: 'ACTIVE',
      metadata: null,
    });
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: 'cust-1',
      connection,
      provider,
      normalizedCustomer: { name: 'Foo', email: 'foo@example.com' },
    });
    assert.strictEqual(result.externalCustomerId, 'existing-id');
    assert.strictEqual(provider.__counters.createCalls, 0);
    assert.strictEqual(provider.__counters.reconcileCalls, 0);
  });
  test('RECONCILIATION HIT: uses reconcile result, does not call create', async () => {
    const provider = makeMockProvider({ reconcileResult: 'recon-id' });
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: 'cust-2',
      connection,
      provider,
      normalizedCustomer: { name: 'Bar', email: 'bar@example.com' },
    });
    assert.strictEqual(result.externalCustomerId, 'recon-id');
    assert.strictEqual(provider.__counters.reconcileCalls, 1);
    assert.strictEqual(provider.__counters.createCalls, 0);
    const { data: row } = await client.from('customer_gateway_identities').select('*').eq('customer_id', 'cust-2').single();
    assert.strictEqual(row?.status, 'ACTIVE');
    assert.strictEqual(row?.external_customer_id, 'recon-id');
  });
  test('RECONCILIATION MISS: falls back to creation', async () => {
    const provider = makeMockProvider({ reconcileResult: null });
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: 'cust-3',
      connection,
      provider,
      normalizedCustomer: { name: 'Baz', email: 'baz@example.com' },
    });
    assert.strictEqual(result.externalCustomerId, `ext-${connection.id}`);
    assert.strictEqual(provider.__counters.reconcileCalls, 1);
    assert.strictEqual(provider.__counters.createCalls, 1);
    const { data: row } = await client.from('customer_gateway_identities').select('*').eq('customer_id', 'cust-3').single();
    assert.strictEqual(row?.status, 'ACTIVE');
    assert.strictEqual(row?.external_customer_id, `ext-${connection.id}`);
  });
  test('CREATE FAILURE: propagates error and marks FAILED', async () => {
    const provider = makeMockProvider({ createShouldFail: true });
    try {
      await resolver.getOrCreateExternalCustomer({
        customerId: 'cust-4',
        connection,
        provider,
        normalizedCustomer: { name: 'Fail', email: 'fail@example.com' },
      });
      assert.fail('expected error');
    } catch (e) {
      assert(e instanceof AppError);
      const err = e as AppError;
      assert.strictEqual(err.code, 'INTERNAL_ERROR');
    }
    const { data: row } = await client.from('customer_gateway_identities').select('*').eq('customer_id', 'cust-4').single();
    assert.strictEqual(row?.status, 'FAILED');
  });
  test('PENDING FOLLOWER: second request polls and receives same ID', async () => {
    const provider = makeMockProvider({ createDelayMs: 1500 });
    const params = {
      customerId: 'cust-5',
      connection,
      provider,
      normalizedCustomer: { name: 'Poll', email: 'poll@example.com' },
    };
    const [a, b] = await Promise.all([
      resolver.getOrCreateExternalCustomer(params),
      new Promise(r => setTimeout(() => r(resolver.getOrCreateExternalCustomer(params)), 100)),
    ]);
    assert.strictEqual(a.externalCustomerId, b.externalCustomerId);
    assert.strictEqual(provider.__counters.createCalls, 1);
  });
  test('PENDING STALE: times out and returns CONFLICT', async () => {
    const provider = makeMockProvider({ createDelayMs: 20000 });
    const params = {
      customerId: 'cust-6',
      connection,
      provider,
      normalizedCustomer: { name: 'Stale', email: 'stale@example.com' },
    };
    try {
      await resolver.getOrCreateExternalCustomer(params);
      assert.fail('expected conflict error');
    } catch (e) {
      assert(e instanceof AppError);
      const err = e as AppError;
      assert.strictEqual(err.code, 'CONFLICT');
    }
  });
  test('FAILED RETRY: recovers from FAILED to ACTIVE', async () => {
    const provider = makeMockProvider({ reconcileResult: null });
    await client.from('customer_gateway_identities').insert({
      customer_id: 'cust-7',
      connection_id: connection.id,
      status: 'FAILED',
      external_customer_id: null,
      metadata: null,
    });
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: 'cust-7',
      connection,
      provider,
      normalizedCustomer: { name: 'Recover', email: 'recover@example.com' },
    });
    assert.strictEqual(result.externalCustomerId, `ext-${connection.id}`);
    const { data: row } = await client.from('customer_gateway_identities').select('*').eq('customer_id', 'cust-7').single();
    assert.strictEqual(row?.status, 'ACTIVE');
  });
  test('PROVIDER WITHOUT RECONCILIATION: creates directly', async () => {
    const provider = makeMockProvider();
    delete (provider as any).capabilities.reconcileExternalCustomer;
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: 'cust-8',
      connection,
      provider,
      normalizedCustomer: { name: 'NoRec', email: 'norec@example.com' },
    });
    assert.strictEqual(result.externalCustomerId, `ext-${connection.id}`);
    assert.strictEqual(provider.__counters.createCalls, 1);
    assert.strictEqual(provider.__counters.reconcileCalls, 0);
  });
  test('IDEMPOTENCY: same deterministic key passed to provider', async () => {
    const provider = makeMockProvider();
    const custId = 'cust-9';
    await resolver.getOrCreateExternalCustomer({
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'Idem', email: 'idem@example.com' },
    });
    const expectedKey = `${custId}-${connection.id}`;
    assert.strictEqual((global as any).__lastIdempotencyKey, expectedKey);
  });
});
