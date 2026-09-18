// tests/api/asaas_webhook.test.ts
import assert from 'node:assert';
import * as http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import { createAdapterServer } from '../../src/api/server';
import { CredentialCipher } from '../../src/lib/crypto/credentials';

const originalFetch = globalThis.fetch;
let mockFetchHandler: ((url: string, init?: RequestInit) => Promise<{ status?: number; body?: any } | null>) | null = null;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('asaas.com')) {
    if (mockFetchHandler) {
      const mocked = await mockFetchHandler(url, init);
      if (mocked) {
        return new Response(JSON.stringify(mocked.body ?? {}), {
          status: mocked.status ?? 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response(JSON.stringify({ error: 'Unmocked asaas route: ' + url }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return originalFetch(input, init);
};

async function setupTestServer(): Promise<{ server: http.Server; baseUrl: string; stop: () => void }> {
  const server = createAdapterServer(0);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () => server.close()
  };
}

async function run() {
  console.log('== RUNNING ASAAS WEBHOOK HTTP ROUTE TESTS ==');

  const supabaseUrl = 'http://127.0.0.1:54321';
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!serviceRoleKey) {
    const { execSync } = require('child_process');
    const statusStr = execSync('npx supabase status -o json').toString();
    const jsonStr = statusStr.substring(statusStr.indexOf('{'));
    const status = JSON.parse(jsonStr);
    serviceRoleKey = status.SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
    process.env.SUPABASE_URL = supabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    process.env.SUPABASE_ANON_KEY = status.ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
  }

  const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const cipher = new CredentialCipher();
  const { server, baseUrl, stop } = await setupTestServer();

  // Initial cleanup of any prior test connections
  await client.from('gateway_connections').delete().eq('provider_id', 'asaas');

  // Setup fixtures
  const { data: org, error: orgErr } = await client.from('organizations').insert({ name: 'Webhook Test Org' }).select().single();
  if (orgErr || !org) throw new Error(`Org setup failed: ${orgErr?.message}`);

  const { data: store, error: storeErr } = await client.from('stores').insert({
    organization_id: org.id,
    name: 'Webhook Test Store',
    slug: `wh-store-${Date.now()}`
  }).select().single();
  if (storeErr || !store) throw new Error(`Store setup failed: ${storeErr?.message}`);

  const { data: cust, error: custErr } = await client.from('customers').insert({
    organization_id: org.id,
    email: `webhook_test_${Date.now()}@pub.test`,
    full_name: 'Webhook Customer'
  }).select().single();
  if (custErr || !cust) throw new Error(`Customer setup failed: ${custErr?.message}`);

  await client.from('gateway_providers').upsert({
    id: 'asaas',
    display_name: 'Asaas Provider',
    is_active: true
  });

  const webhookSecret = 'wh_secret_asaas_xyz_789';
  const encryptedCreds = cipher.encrypt({ apiKey: 'ASAAS_TEST_KEY' });
  const encryptedSecret = cipher.encrypt(webhookSecret);

  const { data: conn, error: connErr } = await client.from('gateway_connections').insert({
    organization_id: org.id,
    provider_id: 'asaas',
    environment: 'SANDBOX',
    is_global_default: false,
    status: 'ACTIVE',
    encrypted_credentials: encryptedCreds,
    webhook_secret_encrypted: encryptedSecret,
    public_key: 'test'
  }).select().single();
  if (connErr || !conn) throw new Error(`Connection setup failed: ${connErr?.message}`);

  // Inventory fixture: webhook settlement must atomically commit an ACTIVE reservation.
  const { data: supplier } = await client.from('suppliers').insert({
    name: 'Webhook Inventory Supplier'
  }).select().single();
  if (!supplier) throw new Error('Supplier setup failed');

  const { data: masterProduct } = await client.from('master_products').insert({
    supplier_id: supplier.id,
    base_sku: `WH-BASE-${Date.now()}`,
    name: 'Webhook Inventory Product'
  }).select().single();
  if (!masterProduct) throw new Error('Master product setup failed');

  const { data: masterVariant } = await client.from('master_product_variants').insert({
    master_product_id: masterProduct.id,
    sku: `WH-SKU-${Date.now()}`,
    cost_price: 50
  }).select().single();
  if (!masterVariant) throw new Error('Master variant setup failed');

  await client.from('master_inventory').insert({
    master_variant_id: masterVariant.id,
    on_hand: 50,
    reserved: 2,
    committed: 0
  });

  const { data: cart } = await client.from('carts').insert({
    store_id: store.id,
    customer_id: cust.id,
    status: 'COMPLETED'
  }).select().single();
  if (!cart) throw new Error('Cart setup failed');

  const { data: checkout } = await client.from('checkouts').insert({
    cart_id: cart.id,
    store_id: store.id,
    status: 'COMPLETED'
  }).select().single();
  if (!checkout) throw new Error('Checkout setup failed');

  const { data: reservation } = await client.from('inventory_reservations').insert({
    master_variant_id: masterVariant.id,
    checkout_id: checkout.id,
    quantity: 2,
    status: 'ACTIVE',
    expires_at: new Date(Date.now() + 900000).toISOString()
  }).select().single();
  if (!reservation) throw new Error('Reservation setup failed');

  const { data: order, error: orderErr } = await client.from('orders').insert({
    organization_id: org.id,
    store_id: store.id,
    customer_id: cust.id,
    checkout_id: checkout.id,
    order_number: `WH-ORD-${Date.now()}`,
    status: 'PENDING_PAYMENT',
    total_amount: 12550,
    currency: 'BRL'
  }).select().single();
  if (orderErr || !order) throw new Error(`Order setup failed: ${orderErr?.message}`);

  const { data: payment, error: payErr } = await client.from('payments').insert({
    order_id: order.id,
    provider: 'asaas',
    gross_amount: 12550,
    currency: 'BRL',
    status: 'PENDING',
    payment_method: 'PIX'
  }).select().single();
  if (payErr || !payment) throw new Error(`Payment setup failed: ${payErr?.message}`);

  const providerPaymentId = 'pay_asaas_wh_001';
  const { data: tx, error: txErr } = await client.from('payment_transactions').insert({
    payment_id: payment.id,
    gateway_connection_id: conn.id,
    provider: 'asaas',
    idempotency_key: `idem-wh-${Date.now()}`,
    type: 'PAY',
    amount: 12550,
    status: 'PROCESSING',
    transaction_id_external: providerPaymentId
  }).select().single();
  if (txErr || !tx) throw new Error(`Transaction setup failed: ${txErr?.message}`);

  // Mock Asaas /payments/:id for active re-fetch during webhook settlement
  mockFetchHandler = async (url) => {
    if (url.includes(`/payments/${providerPaymentId}`)) {
      return {
        status: 200,
        body: {
          id: providerPaymentId,
          status: 'CONFIRMED',
          value: 125.50,
          gatewayFee: 1.99,
          netValue: 123.51,
          paymentDate: new Date().toISOString()
        }
      };
    }
    return null;
  };

  const webhookPayload = JSON.stringify({
    id: 'evt_asaas_001',
    event: 'PAYMENT_CONFIRMED',
    payment: {
      id: providerPaymentId,
      customer: 'cus_001',
      value: 125.50
    }
  });

  try {
    // 1. Invalid Token (HTTP 401)
    {
      const res = await originalFetch(`${baseUrl}/api/webhooks/payments/asaas?connection_id=${conn.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': 'wrong_token'
        },
        body: webhookPayload
      });

      assert.strictEqual(res.status, 401, 'Invalid webhook token must return 401');
      console.log('[PASS] Webhook with invalid token rejected with HTTP 401');
    }

    // 2. Connection Not Found (HTTP 404)
    {
      const res = await originalFetch(`${baseUrl}/api/webhooks/payments/asaas?connection_id=00000000-0000-0000-0000-000000000000`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': webhookSecret
        },
        body: webhookPayload
      });

      assert.strictEqual(res.status, 404, 'Non-existent connection must return 404');
      console.log('[PASS] Webhook with non-existent connection returns HTTP 404');
    }

    // 3. Provider Not Registered / Unknown (HTTP 404 or 500)
    {
      const res = await originalFetch(`${baseUrl}/api/webhooks/payments/unknown_unregistered_gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': webhookSecret
        },
        body: webhookPayload
      });

      assert.ok(res.status === 404 || res.status === 500, `Unknown provider must reject with 404 or 500 (got ${res.status})`);
      console.log('[PASS] Webhook with unregistered provider rejected');
    }

    // 4. Valid Event with Valid Token (HTTP 200 & Settlement)
    {
      const res = await originalFetch(`${baseUrl}/api/webhooks/payments/asaas?connection_id=${conn.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': webhookSecret
        },
        body: webhookPayload
      });

      assert.strictEqual(res.status, 200, 'Valid webhook must return HTTP 200');
      const resJson: any = await res.json();
      assert.strictEqual(resJson.data.status, 'PROCESSED');
      assert.ok(resJson.data.eventId, 'Must return persisted eventId');

      // Verify DB settlement
      const { data: updatedPayment } = await client.from('payments').select('status').eq('id', payment.id).single();
      assert.strictEqual(updatedPayment?.status, 'PAID', 'Payment aggregate must be settled to PAID');

      const { data: updatedOrder } = await client.from('orders').select('status').eq('id', order.id).single();
      assert.strictEqual(updatedOrder?.status, 'PAID', 'Order must be settled to PAID');

      const { data: updatedTx } = await client.from('payment_transactions').select('status').eq('id', tx.id).single();
      assert.strictEqual(updatedTx?.status, 'SUCCESS', 'Payment transaction must be settled to SUCCESS');

      const { data: updatedInventory } = await client
        .from('master_inventory')
        .select('reserved, committed')
        .eq('master_variant_id', masterVariant.id)
        .single();
      assert.strictEqual(updatedInventory?.reserved, 0, 'Reserved inventory must be released on settlement');
      assert.strictEqual(updatedInventory?.committed, 2, 'Committed inventory must increase on settlement');

      const { data: updatedReservation } = await client
        .from('inventory_reservations')
        .select('status')
        .eq('id', reservation.id)
        .single();
      assert.strictEqual(updatedReservation?.status, 'COMMITTED', 'Reservation must become COMMITTED atomically');

      const { data: commitMovement } = await client
        .from('inventory_movements')
        .select('id, quantity, movement_type, reference_id')
        .eq('master_variant_id', masterVariant.id)
        .eq('movement_type', 'COMMIT')
        .eq('reference_id', order.id)
        .single();
      assert.strictEqual(commitMovement?.quantity, 2, 'Settlement must record exactly one COMMIT movement');

      console.log('[PASS] Valid event settled successfully via PaymentHubService.handleWebhook');
    }

    // 5. Duplicate Event (HTTP 200 & DEDUP_SKIPPED)
    {
      const res = await originalFetch(`${baseUrl}/api/webhooks/payments/asaas?connection_id=${conn.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': webhookSecret
        },
        body: webhookPayload
      });

      assert.strictEqual(res.status, 200, 'Duplicate webhook must return HTTP 200');
      const resJson: any = await res.json();
      assert.strictEqual(resJson.data.status, 'DEDUP_SKIPPED', 'Must skip duplicate event');

      // Verify only 1 record in gateway_webhook_events
      const { data: events } = await client
        .from('gateway_webhook_events')
        .select('id')
        .eq('gateway_connection_id', conn.id)
        .eq('event_dedup_key', `PAYMENT_CONFIRMED:${providerPaymentId}`);

      assert.strictEqual(events?.length, 1, 'Must not duplicate webhook event records');
      console.log('[PASS] Duplicate event skipped via event_dedup_key without secondary settlement');
    }

    console.log('== ALL ASAAS WEBHOOK HTTP ROUTE TESTS PASSED ==');
  } finally {
    // Cleanup fixtures
    await client.from('gateway_webhook_events').delete().eq('gateway_connection_id', conn.id);
    await client.from('payment_transactions').delete().eq('payment_id', payment.id);
    await client.from('payments').delete().eq('order_id', order.id);
    await client.from('orders').delete().eq('id', order.id);
    await client.from('gateway_connections').delete().eq('id', conn.id);
    await client.from('inventory_movements').delete().eq('master_variant_id', masterVariant.id);
    await client.from('inventory_reservations').delete().eq('id', reservation.id);
    await client.from('master_inventory').delete().eq('master_variant_id', masterVariant.id);
    await client.from('master_product_variants').delete().eq('id', masterVariant.id);
    await client.from('master_products').delete().eq('id', masterProduct.id);
    await client.from('suppliers').delete().eq('id', supplier.id);
    await client.from('checkouts').delete().eq('id', checkout.id);
    await client.from('carts').delete().eq('id', cart.id);
    await client.from('stores').delete().eq('id', store.id);
    await client.from('customers').delete().eq('id', cust.id);
    await client.from('organizations').delete().eq('id', org.id);

    stop();
    mockFetchHandler = null;
  }
}

run().catch((err) => {
  console.error('Webhook test failure:', err);
  process.exit(1);
});
