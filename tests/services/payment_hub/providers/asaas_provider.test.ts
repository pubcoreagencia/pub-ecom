// tests/services/payment_hub/providers/asaas_provider.test.ts
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../../types/supabase';
import { AsaasProvider, getExternalReference } from '../../../../src/services/payment_hub/providers/asaas_provider';
import { PaymentHubService, PROVIDER_REGISTRY } from '../../../../src/services/payment_hub/service';
import { CredentialCipher } from '../../../../src/lib/crypto/credentials';

const originalFetch = globalThis.fetch;

interface MockResponse {
  status?: number;
  body?: any;
}

let fetchMockHandler: ((url: string, init?: RequestInit) => Promise<MockResponse | null>) | null = null;

function setMockHandler(handler: (url: string, init?: RequestInit) => Promise<MockResponse | null>) {
  fetchMockHandler = handler;
}

function resetMockHandler() {
  fetchMockHandler = null;
}

// Global fetch override for clean deterministic tests without external libraries
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('asaas.com')) {
    if (fetchMockHandler) {
      const mocked = await fetchMockHandler(url, init);
      if (mocked) {
        return new Response(JSON.stringify(mocked.body ?? {}), {
          status: mocked.status ?? 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response(JSON.stringify({ error: 'Unmocked route: ' + url }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return originalFetch(input, init);
};

async function runUnitTests() {
  console.log('== RUNNING ASAAS PROVIDER UNIT TESTS ==');

  const provider = new AsaasProvider();
  const validCreds = { apiKey: 'TEST_ASAAS_KEY' };

  // 1. Provider is stateless and validates credentials on calls
  {
    assert.strictEqual(provider.providerId, 'asaas');
    assert.strictEqual((provider as any).creds, undefined, 'Provider must not store creds field');

    await assert.rejects(
      async () => provider.createPayment({} as any, {} as any),
      /Invalid Asaas credentials: apiKey is required/,
      'Must reject missing apiKey'
    );
    console.log('[PASS] Stateless credentials validation');
  }

  // 2. Deterministic externalReference helper
  {
    assert.strictEqual(getExternalReference('user-uuid-1'), 'pub_customer:user-uuid-1');
    assert.ok(!getExternalReference('user-uuid-1').includes('@'), 'Must never use email in externalReference');
    console.log('[PASS] Deterministic external reference format');
  }

  // 3. Sandbox vs Production URL routing
  {
    let capturedUrl = '';
    setMockHandler(async (url) => {
      capturedUrl = url;
      return { status: 200, body: { data: [] } };
    });

    await provider.reconcileExternalCustomer(
      { customerId: 'c1', connectionId: 'conn1', normalizedCustomer: { name: 'A', email: 'a@a.com' } },
      { apiKey: 'K', environment: 'SANDBOX' }
    );
    assert.ok(capturedUrl.startsWith('https://api-sandbox.asaas.com/v3/customers'), 'Must use sandbox endpoint');

    await provider.reconcileExternalCustomer(
      { customerId: 'c1', connectionId: 'conn1', normalizedCustomer: { name: 'A', email: 'a@a.com' } },
      { apiKey: 'K', environment: 'PRODUCTION' }
    );
    assert.ok(capturedUrl.startsWith('https://api-asaas.com/v3/customers'), 'Must use production endpoint');
    console.log('[PASS] Sandbox / Production URL routing');
  }

  // 4. Reconciliation with Asaas pagination envelope
  {
    // 0 results -> null
    setMockHandler(async (url) => {
      return { status: 200, body: { data: [], totalCount: 0, hasMore: false } };
    });
    const res0 = await provider.reconcileExternalCustomer(
      { customerId: 'c0', connectionId: 'conn1', normalizedCustomer: { name: 'None', email: 'none@a.com' } },
      validCreds
    );
    assert.strictEqual(res0, null, '0 results should resolve to null');

    // 1 result -> customer ID
    setMockHandler(async (url) => {
      assert.ok(url.includes('externalReference=pub_customer%3Ac1'));
      return { status: 200, body: { data: [{ id: 'cus_found_123' }], totalCount: 1, hasMore: false } };
    });
    const res1 = await provider.reconcileExternalCustomer(
      { customerId: 'c1', connectionId: 'conn1', normalizedCustomer: { name: 'One', email: 'one@a.com' } },
      validCreds
    );
    assert.strictEqual(res1, 'cus_found_123', '1 result should resolve to external ID');

    // >1 results -> reconciliation error
    setMockHandler(async () => {
      return { status: 200, body: { data: [{ id: 'cus_1' }, { id: 'cus_2' }], totalCount: 2, hasMore: false } };
    });
    await assert.rejects(
      async () => provider.reconcileExternalCustomer(
        { customerId: 'c_multi', connectionId: 'conn1', normalizedCustomer: { name: 'Multi', email: 'multi@a.com' } },
        validCreds
      ),
      /Multiple external customers found/,
      'Must reject multiple customers on reconciliation'
    );
    console.log('[PASS] Reconciliation parsing and cardinality rules (0, 1, >1)');
  }

  // 5. Customer creation
  {
    let sentBody: any = null;
    let sentHeaders: any = null;
    setMockHandler(async (url, init) => {
      sentBody = JSON.parse(init?.body as string);
      sentHeaders = init?.headers;
      return { status: 200, body: { id: 'cus_created_999' } };
    });

    const createRes = await provider.createExternalCustomer(
      {
        customerId: 'cust-uuid-42',
        connectionId: 'conn-1',
        normalizedCustomer: { name: 'Maria Silva', email: 'maria@example.com', document: '12345678901' }
      },
      validCreds
    );

    assert.strictEqual(createRes.externalId, 'cus_created_999');
    assert.strictEqual(sentBody.name, 'Maria Silva');
    assert.strictEqual(sentBody.email, 'maria@example.com');
    assert.strictEqual(sentBody.cpfCnpj, '12345678901');
    assert.strictEqual(sentBody.externalReference, 'pub_customer:cust-uuid-42');
    assert.strictEqual(sentHeaders['access-token'], 'TEST_ASAAS_KEY');
    console.log('[PASS] Customer creation with deterministic externalReference and document');
  }

  // 6. PIX Payment & QR Code retrieval
  {
    let paymentRequested = false;
    let qrRequested = false;

    setMockHandler(async (url, init) => {
      if (url.endsWith('/payments')) {
        paymentRequested = true;
        const body = JSON.parse(init?.body as string);
        assert.strictEqual(body.customer, 'cus_created_999');
        assert.strictEqual(body.billingType, 'PIX');
        assert.strictEqual(body.value, 150.75);
        return { status: 200, body: { id: 'pay_asaas_001', status: 'PENDING' } };
      }
      if (url.endsWith('/payments/pay_asaas_001/pixQrCode')) {
        qrRequested = true;
        return {
          status: 200,
          body: {
            encodedImage: 'iVBORw0KGgoAAAANSUhEUgAA...',
            payload: '000201010212268...pix...',
            expirationDate: '2026-12-31 23:59:59'
          }
        };
      }
      return null;
    });

    const paymentResult = await provider.createPayment(
      {
        orderId: 'order-1',
        orderNumber: 'PUB-1001',
        amount: 15075, // in cents -> R$ 150.75
        currency: 'BRL',
        customer: { name: 'Maria', email: 'maria@example.com' },
        method: 'PIX',
        externalCustomerId: 'cus_created_999',
        idempotencyKey: 'idem-1'
      },
      validCreds
    );

    assert.ok(paymentRequested, 'Must call create payment');
    assert.ok(qrRequested, 'Must call pixQrCode');
    assert.strictEqual(paymentResult.providerPaymentId, 'pay_asaas_001');
    assert.strictEqual(paymentResult.status, 'PENDING');
    assert.strictEqual(paymentResult.method, 'PIX');
    assert.strictEqual(paymentResult.amount, 15075);
    assert.strictEqual(paymentResult.pixDetails?.qrCode, 'iVBORw0KGgoAAAANSUhEUgAA...');
    assert.strictEqual(paymentResult.pixDetails?.qrCodeUrl, '000201010212268...pix...');
    assert.strictEqual(paymentResult.pixDetails?.expiresAt, '2026-12-31 23:59:59');
    console.log('[PASS] PIX payment creation and QR code mapping');
  }

  // 7. Get Payment status & financial conversion
  {
    setMockHandler(async (url) => {
      if (url.endsWith('/payments/pay_asaas_001')) {
        return {
          status: 200,
          body: {
            id: 'pay_asaas_001',
            status: 'CONFIRMED',
            value: 150.75,
            gatewayFee: 1.99,
            netValue: 148.76,
            paymentDate: '2026-09-15T00:00:00Z'
          }
        };
      }
      return null;
    });

    const statusResult = await provider.getPayment('pay_asaas_001', validCreds);
    assert.strictEqual(statusResult.status, 'PAID');
    assert.strictEqual(statusResult.amount, 15075);
    assert.strictEqual(statusResult.fee, 199);
    assert.strictEqual(statusResult.netAmount, 14876);
    assert.strictEqual(statusResult.dateApproved, '2026-09-15T00:00:00Z');
    console.log('[PASS] Get payment status and integer cents normalization');
  }

  // 8. Status mapping exhaustiveness
  {
    assert.strictEqual(provider.normalizeStatus('CONFIRMED'), 'PAID');
    assert.strictEqual(provider.normalizeStatus('RECEIVED'), 'PAID');
    assert.strictEqual(provider.normalizeStatus('PENDING'), 'PENDING');
    assert.strictEqual(provider.normalizeStatus('AWAITING_RISK_ANALYSIS'), 'PENDING');
    assert.strictEqual(provider.normalizeStatus('REFUNDED'), 'REFUNDED');
    assert.strictEqual(provider.normalizeStatus('CANCELLED'), 'CANCELLED');
    assert.strictEqual(provider.normalizeStatus('CHARGEBACK'), 'CHARGEBACK');
    assert.strictEqual(provider.normalizeStatus('UNKNOWN_STATUS'), 'FAILED');
    console.log('[PASS] Status mapping');
  }

  // 9. Webhook signature and event extraction
  {
    const webhookSecret = 'wh_secret_xyz';
    const payload = JSON.stringify({
      id: 'evt_123',
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_asaas_001' }
    });

    // Valid token
    const validRes = await provider.verifyWebhook(
      { 'asaas-access-token': 'wh_secret_xyz' },
      payload,
      webhookSecret
    );
    assert.strictEqual(validRes.isValid, true);
    assert.strictEqual(validRes.resourceId, 'pay_asaas_001');
    assert.strictEqual(validRes.eventType, 'PAYMENT_CONFIRMED');
    assert.strictEqual(validRes.eventDedupKey, 'PAYMENT_CONFIRMED:pay_asaas_001');

    // Invalid token
    const invalidRes = await provider.verifyWebhook(
      { 'asaas-access-token': 'wrong_token' },
      payload,
      webhookSecret
    );
    assert.strictEqual(invalidRes.isValid, false);
    console.log('[PASS] Webhook verification using asaas-access-token header');
  }

  resetMockHandler();
}

async function runE2EIntegrationTest() {
  console.log('== RUNNING PAYMENT HUB SERVICE E2E INTEGRATION WITH ASAAS ==');
  process.env.APP_ENVIRONMENT = 'SANDBOX';

  const supabaseUrl = 'http://127.0.0.1:54321';
  const { execSync } = require('child_process');
  const statusStr = execSync('npx supabase status -o json').toString();
  const jsonStr = statusStr.substring(statusStr.indexOf('{'));
  const status = JSON.parse(jsonStr);
  const serviceRoleKey = status.SERVICE_ROLE_KEY;

  const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const cipher = new CredentialCipher();
  const service = new PaymentHubService(client);

  // Setup fixtures
  const { data: org, error: orgErr } = await client.from('organizations').insert({ name: 'Asaas E2E Org' }).select().single();
  if (orgErr || !org) throw new Error(`Org failed: ${orgErr?.message}`);

  const { data: store, error: storeErr } = await client.from('stores').insert({
    organization_id: org.id,
    name: 'Asaas Store',
    slug: `asaas-store-${Date.now()}`
  }).select().single();
  if (storeErr || !store) throw new Error(`Store failed: ${storeErr?.message}`);

  const { data: cust, error: custErr } = await client.from('customers').insert({
    organization_id: org.id,
    email: `asaas_e2e_${Date.now()}@pub.test`,
    full_name: 'Asaas EndToEnd Customer',
  }).select().single();
  if (custErr || !cust) throw new Error(`Customer failed: ${custErr?.message}`);

  await client.from('gateway_providers').upsert({
    id: 'asaas',
    display_name: 'Asaas Provider Real Adapter',
    is_active: true,
  });

  const encryptedCreds = cipher.encrypt({ apiKey: 'INTEGRATION_KEY_123' });
  const encryptedWebhook = cipher.encrypt('wh_secret_asaas');

  const { data: conn, error: connErr } = await client.from('gateway_connections').insert({
    organization_id: org.id,
    provider_id: 'asaas',
    environment: 'SANDBOX',
    is_global_default: false,
    status: 'ACTIVE',
    encrypted_credentials: encryptedCreds,
    webhook_secret_encrypted: encryptedWebhook,
    public_key: 'test',
  }).select().single();
  if (connErr || !conn) throw new Error(`Connection failed: ${connErr?.message}`);

  // Create order
  const { data: order, error: orderErr } = await client.from('orders').insert({
    organization_id: org.id,
    store_id: store.id,
    customer_id: cust.id,
    order_number: `PUB-E2E-${Date.now()}`,
    status: 'PENDING_PAYMENT',
    total_amount: 8900,
    currency: 'BRL',
  }).select().single();
  if (orderErr || !order) throw new Error(`Order failed: ${orderErr?.message}`);

  // Mock Asaas HTTP endpoints for the entire flow:
  // 1. Reconcile miss: /customers?externalReference=pub_customer:<cust.id> -> []
  // 2. Customer create: POST /customers -> { id: 'cus_asaas_e2e' }
  // 3. Payment create: POST /payments -> { id: 'pay_asaas_e2e', status: 'PENDING' }
  // 4. Pix QR: GET /payments/pay_asaas_e2e/pixQrCode -> { encodedImage: 'QR', payload: 'EMV', expirationDate: '...' }
  setMockHandler(async (url, init) => {
    if (url.includes('/customers?externalReference=')) {
      return { status: 200, body: { data: [], totalCount: 0, hasMore: false } };
    }
    if (url.endsWith('/customers') && init?.method === 'POST') {
      return { status: 200, body: { id: 'cus_asaas_e2e' } };
    }
    if (url.endsWith('/payments') && init?.method === 'POST') {
      return { status: 200, body: { id: 'pay_asaas_e2e', status: 'PENDING' } };
    }
    if (url.endsWith('/payments/pay_asaas_e2e/pixQrCode')) {
      return {
        status: 200,
        body: {
          encodedImage: 'QR_CODE_DATA',
          payload: 'PIX_CODE_PAYLOAD',
          expirationDate: '2026-12-31'
        }
      };
    }
    return null;
  });

  const intentResult = await service.createPaymentIntent({
    orderId: order!.id,
    method: 'PIX',
    idempotencyKey: `idem-e2e-${Date.now()}`,
    providerId: 'asaas',
    environment: 'SANDBOX'
  });

  assert.strictEqual(intentResult.status, 'PENDING');
  assert.strictEqual(intentResult.pixDetails?.qrCode, 'QR_CODE_DATA');
  assert.strictEqual(intentResult.pixDetails?.qrCodeUrl, 'PIX_CODE_PAYLOAD');

  // Verify external customer identity persisted in database
  const { data: identityRow } = await (client as any)
    .from('customer_gateway_identities')
    .select('*')
    .eq('customer_id', cust.id)
    .eq('connection_id', conn.id)
    .single();

  assert.strictEqual(identityRow?.status, 'ACTIVE');
  assert.strictEqual(identityRow?.external_customer_id, 'cus_asaas_e2e');

  // Verify payment transaction record
  const { data: txRow } = await client
    .from('payment_transactions')
    .select('*')
    .eq('id', intentResult.transactionId)
    .single();

  assert.strictEqual(txRow?.status, 'PROCESSING');
  assert.strictEqual(txRow?.transaction_id_external, 'pay_asaas_e2e');

  console.log('[PASS] Full PaymentHubService -> ConnectionResolver -> AsaasProvider -> ExternalCustomerResolver flow');

  // Cleanup test fixtures
  await (client as any).from('customer_gateway_identities').delete().eq('customer_id', cust.id);
  await client.from('payment_transactions').delete().eq('payment_id', intentResult.paymentId);
  await client.from('payments').delete().eq('order_id', order.id);
  await client.from('orders').delete().eq('id', order.id);
  await client.from('gateway_connections').delete().eq('id', conn.id);
  await client.from('stores').delete().eq('id', store.id);
  await client.from('customers').delete().eq('id', cust.id);
  await client.from('organizations').delete().eq('id', org.id);

  resetMockHandler();
}

async function main() {
  await runUnitTests();
  await runE2EIntegrationTest();
  console.log('== ALL ASAAS PROVIDER TESTS PASSED ==');
}

main().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
