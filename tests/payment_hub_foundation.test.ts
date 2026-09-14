import assert from 'node:assert';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { CredentialCipher } from '../src/lib/crypto/credentials';
import { ConnectionResolver } from '../src/services/payment_hub/resolver';
import { PaymentHubService, PROVIDER_REGISTRY } from '../src/services/payment_hub/service';

async function run() {
  console.log('== RUNNING PAYMENT HUB FOUNDATION (00017) TESTS ==');

  // Enforce authoritative APP_ENVIRONMENT for test suite
  process.env.APP_ENVIRONMENT = 'SANDBOX';

  const SUPABASE_URL = 'http://127.0.0.1:54321';
  let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    const statusStr = execSync('npx supabase status -o json').toString();
    const jsonStr = statusStr.substring(statusStr.indexOf('{'));
    const status = JSON.parse(jsonStr);
    SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  }

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false }
  });

  const cipher = new CredentialCipher();

  let orgId: string;
  let storeId: string;
  let globalConnId: string;
  let orgConnId: string;
  let storeConnId: string;
  let suspendedConnId: string;
  let orderId: string;
  let customerId: string;

  // --- SETUP ---
  // Break cyclic FK between payments and payment_transactions first
  await client.from('gateway_webhook_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('payments').update({ settled_transaction_id: null, settled_gateway_connection_id: null, status: 'PENDING' }).neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('payment_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('gateway_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('gateway_providers').delete().neq('id', '');

  // Register test providers in structural catalog
  const { error: provErr } = await client.from('gateway_providers').insert([
    { id: 'test_provider', display_name: 'Test Gateway Provider', is_active: true },
    { id: 'inactive_provider', display_name: 'Inactive Gateway Provider', is_active: false }
  ]);
  assert.ok(!provErr, `Failed to register test providers: ${provErr?.message}`);

  const { data: org, error: orgErr } = await client
    .from('organizations')
    .insert({ name: 'Payment Hub Test Org' })
    .select('id')
    .single();
  assert.ok(org, `Failed to create org: ${orgErr?.message}`);
  orgId = org.id;

  const { data: store, error: storeErr } = await client
    .from('stores')
    .insert({ organization_id: orgId, name: 'Payment Hub Store', slug: 'payhub-' + Date.now() })
    .select('id')
    .single();
  assert.ok(store, `Failed to create store: ${storeErr?.message}`);
  storeId = store.id;

  const encryptedCreds = cipher.encrypt({ apiKey: 'TEST_KEY_RAW' });
  const encryptedSecret = cipher.encrypt('test_webhook_secret');

  // Insert Global Default Connection
  const { data: gConn, error: gErr } = await client
    .from('gateway_connections')
    .insert({
      provider_id: 'test_provider',
      environment: 'SANDBOX',
      is_global_default: true,
      status: 'ACTIVE',
      encrypted_credentials: encryptedCreds,
      webhook_secret_encrypted: encryptedSecret,
      public_key: 'TEST_GLOBAL_PUBLIC_KEY'
    })
    .select('id')
    .single();
  assert.ok(gConn, 'Failed to create global connection: ' + JSON.stringify(gErr));
  globalConnId = gConn.id;

  // Insert Org Connection
  const { data: oConn } = await client
    .from('gateway_connections')
    .insert({
      organization_id: orgId,
      provider_id: 'test_provider',
      environment: 'SANDBOX',
      is_global_default: false,
      status: 'ACTIVE',
      encrypted_credentials: encryptedCreds,
      webhook_secret_encrypted: encryptedSecret,
      public_key: 'TEST_ORG_PUBLIC_KEY'
    })
    .select('id')
    .single();
  assert.ok(oConn, 'Failed to create org connection');
  orgConnId = oConn.id;

  // Insert Store Override Connection
  const { data: sConn } = await client
    .from('gateway_connections')
    .insert({
      organization_id: orgId,
      store_id: storeId,
      provider_id: 'test_provider',
      environment: 'SANDBOX',
      is_global_default: false,
      status: 'ACTIVE',
      encrypted_credentials: encryptedCreds,
      webhook_secret_encrypted: encryptedSecret,
      public_key: 'TEST_STORE_PUBLIC_KEY'
    })
    .select('id')
    .single();
  assert.ok(sConn, 'Failed to create store connection');
  storeConnId = sConn.id;

  // Insert Suspended Connection under separate org
  const { data: otherOrg } = await client.from('organizations').insert({ name: 'Other Org' }).select().single();
  const { data: suspConn } = await client
    .from('gateway_connections')
    .insert({
      organization_id: otherOrg?.id,
      provider_id: 'test_provider',
      environment: 'SANDBOX',
      status: 'SUSPENDED',
      encrypted_credentials: encryptedCreds
    })
    .select('id')
    .single();
  suspendedConnId = suspConn!.id;

  // Create Real Customer & Order Fixture
  const { data: cust } = await client.from('customers').insert({
    organization_id: orgId,
    email: `paytest_${Date.now()}@example.com`,
    full_name: 'Payment Tester Real'
  }).select().single();
  customerId = cust!.id;

  const { data: ord } = await client.from('orders').insert({
    organization_id: orgId,
    store_id: storeId,
    customer_id: customerId,
    order_number: 'ORD-TEST-' + Date.now(),
    status: 'PENDING_PAYMENT',
    currency: 'BRL',
    total_amount: 150.00
  }).select().single();
  orderId = ord!.id;

  // [TEST 1]
  console.log('[TEST 1] Invalid global connection shape rejected');
  const { error: err1 } = await client.from('gateway_connections').insert({
    organization_id: orgId,
    is_global_default: true,
    provider_id: 'test_provider',
    environment: 'SANDBOX',
    encrypted_credentials: encryptedCreds
  });
  assert.ok(err1, 'Must reject invalid global connection scope');
  assert.ok(err1.message.includes('chk_gateway_connection_scope'));

  // [TEST 2]
  console.log('[TEST 2] Cross-organization store mismatch rejected by composite FK');
  const { data: alienOrg } = await client.from('organizations').insert({ name: 'Alien Org' }).select().single();
  const { data: separateStore } = await client.from('stores').insert({ organization_id: orgId, name: 'Separate Store', slug: 'sep-st-' + Date.now() }).select().single();
  const { error: err2 } = await client.from('gateway_connections').insert({
    organization_id: alienOrg!.id,
    store_id: separateStore!.id,
    provider_id: 'test_provider',
    environment: 'SANDBOX',
    encrypted_credentials: encryptedCreds
  });
  assert.ok(err2, 'Must reject cross-organization store connection');
  assert.ok(err2.message.includes('gateway_connections_store_id_organization_id_fkey'));

  // [TEST 3]
  console.log('[TEST 3] Active connection uniqueness per scope/environment/provider enforced');
  const { error: err3 } = await client.from('gateway_connections').insert({
    is_global_default: true,
    provider_id: 'test_provider',
    environment: 'SANDBOX',
    status: 'ACTIVE',
    encrypted_credentials: encryptedCreds
  });
  assert.ok(err3, 'Must reject duplicate active global connection');
  assert.ok(err3.message.includes('uq_gateway_conn_global_active'));

  // [TEST 4]
  console.log('[TEST 4] Revoked connection rotation allows new active connection');
  const { data: rotOrg } = await client.from('organizations').insert({ name: 'Rot Org' }).select().single();
  const { data: connA } = await client.from('gateway_connections').insert({
    organization_id: rotOrg!.id,
    provider_id: 'test_provider',
    environment: 'SANDBOX',
    status: 'ACTIVE',
    encrypted_credentials: encryptedCreds
  }).select().single();

  await client.from('gateway_connections').update({ status: 'REVOKED' }).eq('id', connA!.id);

  const { data: connB, error: bErr } = await client.from('gateway_connections').insert({
    organization_id: rotOrg!.id,
    provider_id: 'test_provider',
    environment: 'SANDBOX',
    status: 'ACTIVE',
    encrypted_credentials: encryptedCreds
  }).select().single();
  assert.ok(connB, `Rotation must succeed when previous is REVOKED: ${bErr?.message}`);

  // [TEST 5]
  console.log('[TEST 5] Connection resolution: Store override -> Org default -> Global default');
  const resolver = new ConnectionResolver(client);
  const resStore = await resolver.resolve({ storeId, organizationId: orgId, providerId: 'test_provider' });
  assert.strictEqual(resStore.id, storeConnId);

  const resOrg = await resolver.resolve({ organizationId: orgId, providerId: 'test_provider' });
  assert.strictEqual(resOrg.id, orgConnId);

  const { data: emptyOrg } = await client.from('organizations').insert({ name: 'Empty Org' }).select().single();
  const resGlobal = await resolver.resolve({ organizationId: emptyOrg!.id, providerId: 'test_provider' });
  assert.strictEqual(resGlobal.id, globalConnId);

  // [TEST 6]
  console.log('[TEST 6] Suspended connection blocks resolution with explicit error');
  const { data: suspConnRow } = await client.from('gateway_connections').select('organization_id').eq('id', suspendedConnId).single();
  await assert.rejects(
    async () => resolver.resolve({ organizationId: suspConnRow!.organization_id!, providerId: 'test_provider' }),
    (err: any) => err.internalMessage.includes('GATEWAY_CONNECTION_SUSPENDED')
  );

  // [TEST 7]
  console.log('[TEST 7] Inactive provider rejected in resolution');
  await assert.rejects(
    async () => resolver.resolve({ organizationId: orgId, providerId: 'inactive_provider' }),
    (err: any) => err.internalMessage.includes('PROVIDER_NOT_AVAILABLE')
  );

  // [TEST 8]
  console.log('[TEST 8] Environment configuration validation (no silent fallback)');
  const originalEnv = process.env.APP_ENVIRONMENT;
  delete process.env.APP_ENVIRONMENT;
  await assert.rejects(
    async () => resolver.resolve({ organizationId: orgId, providerId: 'test_provider' }),
    (err: any) => err.internalMessage.includes('INVALID_APP_ENVIRONMENT')
  );
  process.env.APP_ENVIRONMENT = originalEnv;

  // [TEST 9]
  console.log('[TEST 9] Unregistered provider adapter returns PAYMENT_PROVIDER_NOT_IMPLEMENTED');
  assert.strictEqual(Object.keys(PROVIDER_REGISTRY).length, 0, 'Registry must be empty in foundation phase');
  const hub = new PaymentHubService(client);
  await assert.rejects(
    async () => hub.createPaymentIntent({
      orderId,
      providerId: 'test_provider',
      method: 'CREDIT_CARD',
      idempotencyKey: 'idemp-unreg-' + Date.now()
    }),
    (err: any) => err.internalMessage.includes('PAYMENT_PROVIDER_NOT_IMPLEMENTED')
  );

  // [TEST 10]
  console.log('[TEST 10] Concurrency invariant: Database rejects multiple PROCESSING transactions for same payment');
  const { data: payConcur } = await client.from('payments').insert({
    order_id: orderId,
    gross_amount: 150.00,
    currency: 'BRL',
    status: 'PENDING',
    payment_method: 'CREDIT_CARD',
    provider: 'test_provider'
  }).select().single();

  const { data: txConcur1 } = await client.from('payment_transactions').insert({
    payment_id: payConcur!.id,
    gateway_connection_id: globalConnId,
    provider: 'test_provider',
    idempotency_key: 'concur-tx-1-' + Date.now(),
    type: 'PAY',
    amount: 150.00,
    status: 'PROCESSING'
  }).select().single();
  assert.ok(txConcur1);

  // Attempt concurrent second transaction in status PROCESSING
  const { error: concurErr } = await client.from('payment_transactions').insert({
    payment_id: payConcur!.id,
    gateway_connection_id: globalConnId,
    provider: 'test_provider',
    idempotency_key: 'concur-tx-2-' + Date.now(),
    type: 'PAY',
    amount: 150.00,
    status: 'PROCESSING'
  });
  assert.ok(concurErr, 'Database must reject concurrent PROCESSING transactions on the same payment');
  assert.ok(concurErr.message.includes('uq_payment_tx_single_processing'));

  // Cleanup concurrency test fixture
  await client.from('payment_transactions').delete().eq('id', txConcur1!.id);
  await client.from('payments').delete().eq('id', payConcur!.id);

  // [TEST 10-B] Service-level real concurrency test: Promise.all simultaneous calls
  console.log('[TEST 10-B] Service-level concurrency: Promise.all concurrent aggregate acquisition');
  // Temporary test adapter registered strictly for service concurrency flow validation
  const testAdapter = {
    providerId: 'test_provider',
    async createPayment(input: any) {
      return {
        providerPaymentId: 'test_tx_' + Date.now(),
        status: 'PENDING' as const,
        method: 'CREDIT_CARD' as const,
        amount: input.amount,
        currency: 'BRL' as const
      };
    },
    async getPayment() { throw new Error('Not used'); },
    async verifyWebhook() { throw new Error('Not used'); },
    normalizeStatus() { return 'PENDING' as const; }
  };
  PROVIDER_REGISTRY['test_provider'] = testAdapter;

  const { data: concurOrder } = await client.from('orders').insert({
    organization_id: orgId,
    store_id: storeId,
    customer_id: customerId,
    order_number: 'ORD-CONCUR-' + Date.now(),
    status: 'PENDING_PAYMENT',
    currency: 'BRL',
    total_amount: 200.00
  }).select().single();

  // Fire 2 simultaneous requests against the same virgin order
  const results = await Promise.allSettled([
    hub.createPaymentIntent({
      orderId: concurOrder!.id,
      providerId: 'test_provider',
      method: 'CREDIT_CARD',
      idempotencyKey: 'idemp-concur-A-' + Date.now()
    }),
    hub.createPaymentIntent({
      orderId: concurOrder!.id,
      providerId: 'test_provider',
      method: 'CREDIT_CARD',
      idempotencyKey: 'idemp-concur-B-' + Date.now()
    })
  ]);

  // Clean up temporary test provider from registry immediately
  delete PROVIDER_REGISTRY['test_provider'];

  // 1. Neither request must fail with 500 / PAYMENT_AGGREGATE_ERROR
  for (const r of results) {
    if (r.status === 'rejected') {
      const err = r.reason;
      assert.ok(!err.internalMessage?.includes('PAYMENT_AGGREGATE_ERROR'), 'Must not fail with PAYMENT_AGGREGATE_ERROR');
      // The losing request must have been rejected gracefully by concurrency controls (either active tx in processing or concurrent attempt)
      assert.ok(
        err.internalMessage?.includes('CONCURRENT_TRANSACTION_IN_PROCESSING') ||
        err.internalMessage?.includes('CONCURRENT_PAYMENT_ATTEMPT'),
        `Unexpected error message: ${err.internalMessage}`
      );
    }
  }

  // 2. Exactly one payment aggregate created for this order
  const { data: createdPayments } = await client
    .from('payments')
    .select('id, status, order_id')
    .eq('order_id', concurOrder!.id);
  assert.strictEqual(createdPayments?.length, 1, 'Must have exactly 1 payment aggregate for the order');

  // 3. At most one transaction in status PROCESSING for this aggregate
  const { data: processingTxs } = await client
    .from('payment_transactions')
    .select('id, status')
    .eq('payment_id', createdPayments![0].id)
    .eq('status', 'PROCESSING');
  assert.ok(processingTxs && processingTxs.length <= 1, 'Must have at most 1 PROCESSING transaction');

  // Cleanup concurrency order fixture
  await client.from('payment_transactions').delete().eq('payment_id', createdPayments![0].id);
  await client.from('payments').delete().eq('id', createdPayments![0].id);
  await client.from('orders').delete().eq('id', concurOrder!.id);

  // [TEST 11]
  console.log('[TEST 11] Winner FK invariant: triplet (settled_transaction_id, payment_id, settled_gateway_connection_id)');
  const { data: pay } = await client.from('payments').insert({
    order_id: orderId,
    gross_amount: 150.00,
    currency: 'BRL',
    status: 'PENDING',
    payment_method: 'PIX',
    provider: 'test_provider'
  }).select().single();

  const { data: tx1 } = await client.from('payment_transactions').insert({
    payment_id: pay!.id,
    gateway_connection_id: storeConnId,
    provider: 'test_provider',
    idempotency_key: 'idemp-test-winner-1',
    type: 'PAY',
    amount: 150.00,
    status: 'PROCESSING'
  }).select().single();

  const { error: invErr } = await client.from('payments').update({
    status: 'PAID',
    settled_transaction_id: tx1!.id,
    settled_gateway_connection_id: globalConnId // Intentionally mismatching connection
  }).eq('id', pay!.id);

  assert.ok(invErr, 'Must reject mismatching settled connection vs transaction connection');
  assert.ok(invErr.message.includes('fk_payments_settled_winner_triplet'));

  // [TEST 12]
  console.log('[TEST 12] Atomic settlement RPC: controlled fixture transitions payment and order to PAID');
  const { data: settleSuccess, error: rpcErr } = await client.rpc('settle_payment_transaction', {
    p_payment_id: pay!.id,
    p_transaction_id: tx1!.id,
    p_connection_id: storeConnId,
    p_transaction_id_external: 'ext_tx_mock_123',
    p_verified_amount: 150.00,
    p_verified_currency: 'BRL',
    p_gateway_fee: 3.50,
    p_net_amount: 146.50,
    p_verified_outcome: 'SUCCESS'
  });
  assert.ok(!rpcErr, `Settlement RPC error: ${rpcErr?.message}`);
  assert.strictEqual(settleSuccess, true);

  const { data: checkOrder } = await client.from('orders').select('status').eq('id', orderId).single();
  assert.strictEqual(checkOrder?.status, 'PAID');

  const { data: checkPay } = await client.from('payments').select('status, settled_gateway_connection_id, settled_transaction_id, net_amount, gateway_fee').eq('id', pay!.id).single();
  assert.strictEqual(checkPay?.status, 'PAID');
  assert.strictEqual(checkPay?.settled_gateway_connection_id, storeConnId);
  assert.strictEqual(checkPay?.settled_transaction_id, tx1!.id);
  assert.strictEqual(Number(checkPay?.net_amount), 146.50);

  // [TEST 13]
  console.log('[TEST 13] Stale transaction conflict: different transaction cannot overwrite settled aggregate');
  const { data: tx2 } = await client.from('payment_transactions').insert({
    payment_id: pay!.id,
    gateway_connection_id: globalConnId,
    provider: 'test_provider',
    idempotency_key: 'stale-tx2-' + Date.now(),
    type: 'PAY',
    amount: 150.00,
    status: 'PROCESSING'
  }).select().single();

  const { error: staleErr } = await client.rpc('settle_payment_transaction', {
    p_payment_id: pay!.id,
    p_transaction_id: tx2!.id,
    p_connection_id: globalConnId,
    p_transaction_id_external: 'mock_stale_999',
    p_verified_amount: 150.00,
    p_verified_currency: 'BRL',
    p_gateway_fee: 1.50,
    p_net_amount: 148.50,
    p_verified_outcome: 'SUCCESS'
  });

  assert.ok(staleErr, 'Must reject stale transaction overwrite');
  assert.ok(staleErr.message.includes('PAYMENT_ALREADY_SETTLED_BY_ANOTHER_TRANSACTION'));

  // [TEST 14]
  console.log('[TEST 14] Webhook deduplication infrastructure at database level');
  const { data: ev1, error: evErr1 } = await client.from('gateway_webhook_events').insert({
    gateway_connection_id: globalConnId,
    event_dedup_key: 'evt_dedup_001',
    provider_resource_id: 'res_001',
    event_type: 'payment.created',
    raw_payload: { event: 'test' },
    processing_status: 'PENDING'
  }).select().single();
  assert.ok(ev1, `Failed to insert webhook event: ${evErr1?.message}`);

  const { error: evErr2 } = await client.from('gateway_webhook_events').insert({
    gateway_connection_id: globalConnId,
    event_dedup_key: 'evt_dedup_001',
    provider_resource_id: 'res_001',
    event_type: 'payment.created',
    raw_payload: { event: 'test' },
    processing_status: 'PENDING'
  });
  assert.ok(evErr2, 'Database must enforce unique constraint on webhook deduplication key per connection');
  assert.ok(evErr2.message.includes('uq_gateway_webhook_events_dedup'));

  // [TEST 15]
  console.log('[TEST 15] Credential encryption, decryption, and key rotation compatibility');
  const multiKeyCipher = new CredentialCipher({
    current: 'v2',
    keys: {
      v1: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      v2: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
    }
  });

  const ciphertextV2 = multiKeyCipher.encrypt({ apiKey: 'SUPER_SECRET_V2' });
  assert.ok(ciphertextV2.startsWith('v2:'));
  const decryptedV2 = multiKeyCipher.decrypt(ciphertextV2);
  assert.strictEqual(decryptedV2.apiKey, 'SUPER_SECRET_V2');

  const cipherV1 = new CredentialCipher({
    current: 'v1',
    keys: { v1: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }
  });
  const ciphertextV1 = cipherV1.encrypt({ legacyKey: 'OLD_KEY_V1' });
  const decryptedOld = multiKeyCipher.decrypt(ciphertextV1);
  assert.strictEqual(decryptedOld.legacyKey, 'OLD_KEY_V1');

  console.log('== ALL 00017 PAYMENT HUB FOUNDATION TESTS PASSED SUCCESSFULLY ==');
}

run().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
