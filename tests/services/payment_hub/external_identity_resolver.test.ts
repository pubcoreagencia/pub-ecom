// tests/services/payment_hub/external_identity_resolver.test.ts
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../types/supabase';
import { ExternalCustomerResolver } from '../../../src/services/payment_hub/external_identity_resolver';
import { PaymentProvider } from '../../../src/services/payment_hub/types';
import { AppError } from '../../../src/lib/errors/model';

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
const db: any = client;

function makeMockProvider(opts?: {
  reconcileResult?: string | null;
  createDelayMs?: number;
  createShouldFail?: boolean;
}) {
  const counters = {
    createCalls: 0,
    reconcileCalls: 0,
    createdIds: [] as string[]
  };
  const provider: PaymentProvider = {
    providerId: 'resolver_test_provider',
    createPayment: async () => ({ providerPaymentId: '', status: 'PAID', method: 'PIX', amount: 1000, currency: 'BRL', rawResponse: {} }),
    getPayment: async () => ({ status: 'PAID', amount: 1000, currency: 'BRL' }),
    verifyWebhook: async () => ({ isValid: true, eventDedupKey: 'k', resourceId: 'r', eventType: 'e' }),
    normalizeStatus: () => 'PAID',
    capabilities: {
      async createExternalCustomer({ customerId, connectionId, normalizedCustomer, idempotencyKey }, creds) {
        counters.createCalls++;
        if (opts?.createShouldFail) {
          throw new Error('external creation failed');
        }
        if (opts?.createDelayMs) {
          await new Promise(r => setTimeout(r, opts.createDelayMs));
        }
        const extId = `ext-${connectionId}`;
        counters.createdIds.push(extId);
        (global as any).__lastIdempotencyKey = idempotencyKey;
        return { externalId: extId, metadata: { source: 'mock' } };
      },
      async reconcileExternalCustomer({ customerId, connectionId, normalizedCustomer }, creds) {
        counters.reconcileCalls++;
        return opts?.reconcileResult ?? null;
      },
    },
  };
  (provider as any).__counters = counters;
  return provider as PaymentProvider & { __counters: typeof counters };
}

async function cleanTables() {
  await db.from('customer_gateway_identities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('gateway_connections').delete().eq('provider_id', 'resolver_test_provider');
  await client.from('gateway_providers').delete().eq('id', 'resolver_test_provider');
}

async function setupFixtures() {
  await client.from('gateway_providers').upsert({
    id: 'resolver_test_provider',
    display_name: 'Resolver Test',
    is_active: true,
  });

  const { data: conn, error: connErr } = await client.from('gateway_connections').insert({
    organization_id: null,
    store_id: null,
    provider_id: 'resolver_test_provider',
    environment: 'SANDBOX',
    is_global_default: true,
    status: 'ACTIVE',
    encrypted_credentials: '{}',
    webhook_secret_encrypted: '{}',
    public_key: 'test',
  }).select().single();

  if (connErr) throw new Error(`Connection insert failed: ${connErr.message}`);
  return conn!;
}

async function createTestCustomer(email: string): Promise<string> {
  const { data: org, error: orgErr } = await client.from('organizations').insert({ name: `Org for ${email}` }).select().single();
  if (orgErr || !org) throw new Error(`Org creation failed: ${orgErr?.message}`);

  const { data: cust, error } = await client.from('customers').insert({
    organization_id: org.id,
    email,
    full_name: 'Resolver Test Customer',
  }).select().single();
  if (error || !cust) throw new Error(`Customer creation failed: ${error?.message}`);
  return cust.id;
}

async function run() {
  console.log('== RUNNING EXTERNAL IDENTITY RESOLVER TESTS ==');
  await cleanTables();
  const connection = await setupFixtures();
  const resolver = new ExternalCustomerResolver(client);

  const resetIdentities = async () => {
    await db.from('customer_gateway_identities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  };

  // Test 1: ACTIVE returns existing
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust1@test.com');
    const provider = makeMockProvider();
    await db.from('customer_gateway_identities').insert({
      customer_id: custId,
      connection_id: connection.id,
      external_customer_id: 'existing-id',
      status: 'ACTIVE',
      metadata: null,
    });
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'Foo', email: 'cust1@test.com' },
    });
    assert.strictEqual(result.externalCustomerId, 'existing-id');
    assert.strictEqual(provider.__counters.createCalls, 0);
    assert.strictEqual(provider.__counters.reconcileCalls, 0);
    console.log('[PASS] ACTIVE: returns existing external ID without calling capabilities');
  }

  // Test 2: RECONCILIATION HIT
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust2@test.com');
    const provider = makeMockProvider({ reconcileResult: 'recon-id' });
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'Bar', email: 'cust2@test.com' },
    });
    assert.strictEqual(result.externalCustomerId, 'recon-id');
    assert.strictEqual(provider.__counters.reconcileCalls, 1);
    assert.strictEqual(provider.__counters.createCalls, 0);
    const { data: row } = await db.from('customer_gateway_identities').select('*').eq('customer_id', custId).single();
    assert.strictEqual(row?.status, 'ACTIVE');
    assert.strictEqual(row?.external_customer_id, 'recon-id');
    console.log('[PASS] RECONCILIATION HIT: uses reconcile result, does not call create');
  }

  // Test 3: RECONCILIATION MISS
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust3@test.com');
    const provider = makeMockProvider({ reconcileResult: null });
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'Baz', email: 'cust3@test.com' },
    });
    assert.strictEqual(result.externalCustomerId, `ext-${connection.id}`);
    assert.strictEqual(provider.__counters.reconcileCalls, 1);
    assert.strictEqual(provider.__counters.createCalls, 1);
    const { data: row } = await db.from('customer_gateway_identities').select('*').eq('customer_id', custId).single();
    assert.strictEqual(row?.status, 'ACTIVE');
    assert.strictEqual(row?.external_customer_id, `ext-${connection.id}`);
    console.log('[PASS] RECONCILIATION MISS: falls back to creation');
  }

  // Test 4: CREATE FAILURE
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust4@test.com');
    const provider = makeMockProvider({ createShouldFail: true });
    try {
      await resolver.getOrCreateExternalCustomer({
        customerId: custId,
        connection,
        provider,
        normalizedCustomer: { name: 'Fail', email: 'cust4@test.com' },
      });
      assert.fail('expected error');
    } catch (e) {
      assert(e instanceof AppError);
      const err = e as AppError;
      assert.strictEqual(err.code, 'INTERNAL_ERROR');
    }
    const { data: row } = await db.from('customer_gateway_identities').select('*').eq('customer_id', custId).single();
    assert.strictEqual(row?.status, 'FAILED');
    console.log('[PASS] CREATE FAILURE: propagates error and marks FAILED');
  }

  // Test 5: PENDING FOLLOWER
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust5@test.com');
    const provider = makeMockProvider({ createDelayMs: 1500 });
    const params = {
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'Poll', email: 'cust5@test.com' },
    };
    const [a, b] = await Promise.all([
      resolver.getOrCreateExternalCustomer(params),
      new Promise<any>(r => setTimeout(() => r(resolver.getOrCreateExternalCustomer(params)), 100)),
    ]);
    assert.strictEqual(a.externalCustomerId, b.externalCustomerId);
    assert.strictEqual(provider.__counters.createCalls, 1);
    console.log('[PASS] PENDING FOLLOWER: second request polls and receives same ID');
  }

  // Test 6: PENDING STALE
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust6@test.com');
    await db.from('customer_gateway_identities').insert({
      customer_id: custId,
      connection_id: connection.id,
      status: 'PENDING',
      external_customer_id: null,
      metadata: null,
    });
    const provider = makeMockProvider();
    const params = {
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'Stale', email: 'cust6@test.com' },
    };
    try {
      await resolver.getOrCreateExternalCustomer(params);
      assert.fail('expected conflict error');
    } catch (e) {
      assert(e instanceof AppError);
      const err = e as AppError;
      assert.strictEqual(err.code, 'CONFLICT');
    }
    console.log('[PASS] PENDING STALE: times out and returns CONFLICT');
  }

  // Test 7: FAILED RETRY
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust7@test.com');
    const provider = makeMockProvider({ reconcileResult: null });
    await db.from('customer_gateway_identities').insert({
      customer_id: custId,
      connection_id: connection.id,
      status: 'FAILED',
      external_customer_id: null,
      metadata: null,
    });
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'Recover', email: 'cust7@test.com' },
    });
    assert.strictEqual(result.externalCustomerId, `ext-${connection.id}`);
    const { data: row } = await db.from('customer_gateway_identities').select('*').eq('customer_id', custId).single();
    assert.strictEqual(row?.status, 'ACTIVE');
    console.log('[PASS] FAILED RETRY: recovers from FAILED to ACTIVE');
  }

  // Test 8: PROVIDER WITHOUT RECONCILIATION
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust8@test.com');
    const provider = makeMockProvider();
    delete (provider as any).capabilities.reconcileExternalCustomer;
    const result = await resolver.getOrCreateExternalCustomer({
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'NoRec', email: 'cust8@test.com' },
    });
    assert.strictEqual(result.externalCustomerId, `ext-${connection.id}`);
    assert.strictEqual(provider.__counters.createCalls, 1);
    assert.strictEqual(provider.__counters.reconcileCalls, 0);
    console.log('[PASS] PROVIDER WITHOUT RECONCILIATION: creates directly');
  }

  // Test 9: IDEMPOTENCY
  {
    await resetIdentities();
    const custId = await createTestCustomer('cust9@test.com');
    const provider = makeMockProvider();
    await resolver.getOrCreateExternalCustomer({
      customerId: custId,
      connection,
      provider,
      normalizedCustomer: { name: 'Idem', email: 'cust9@test.com' },
    });
    const expectedKey = `${custId}-${connection.id}`;
    assert.strictEqual((global as any).__lastIdempotencyKey, expectedKey);
    console.log('[PASS] IDEMPOTENCY: same deterministic key passed to provider');
  }

  await cleanTables();
  console.log('== ALL RESOLVER UNIT TESTS PASSED ==');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
