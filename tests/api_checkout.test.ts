import assert from 'node:assert';
import ws from 'ws';
(global as any).WebSocket = ws;
import { createAdapterServer } from '../src/api/server';
import { createAdminClient } from '../src/lib/supabase/admin';
import * as http from 'node:http';
import crypto from 'node:crypto';

async function setupTestServer(): Promise<{ server: http.Server; baseUrl: string; stop: () => void }> {
  const server = createAdapterServer(0);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  return {
    server,
    baseUrl: `http://localhost:${port}`,
    stop: () => server.close()
  };
}

async function runApiTests() {
  const SUPABASE_URL = 'http://localhost:54321';
  let SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    const { execSync } = require('child_process');
    const statusStr = execSync('npx supabase status -o json').toString();
    const status = JSON.parse(statusStr.substring(statusStr.indexOf('{')));
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = status.ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  }

  const adminClient = createAdminClient();

  // Create Org & Store
  let orgRes = await adminClient.from('organizations').select('id').eq('name', 'API Test Org').single();
  let orgId = orgRes.data?.id;
  if (!orgId) {
    const i = await adminClient.from('organizations').insert({ name: 'API Test Org' }).select('id').single();
    orgId = i.data!.id;
  }

  let storeRes = await adminClient.from('stores').select('id').eq('organization_id', orgId).single();
  let storeId = storeRes.data?.id;
  if (!storeId) {
    const s = await adminClient.from('stores').insert({ organization_id: orgId, name: 'API Store', slug: 'api-store-' + Date.now(), status: 'ACTIVE' }).select('id').single();
    storeId = s.data!.id;
  }
  
  const testDomain = 'api-test-' + Date.now() + '.localhost';
  const domainRes = await adminClient.from('store_domains').upsert({ store_id: storeId, domain: testDomain }, { onConflict: 'domain' });
  if (domainRes.error) {
    throw new Error('Failed to setup store_domain: ' + JSON.stringify(domainRes.error));
  }

  // Insert an unpublished product to ensure it doesn't show up
  const masterUnpub = await adminClient.from('master_products').insert({
    name: 'Unpublished Test',
    description: 'Should not appear',
    base_sku: 'UNP' + Date.now().toString().slice(-4),
    status: 'INACTIVE'
  }).select('id').single();
  if (masterUnpub.error) throw new Error('master_products error: ' + JSON.stringify(masterUnpub.error));
  const unpubProductId = masterUnpub.data!.id;

  const storeUnpub = await adminClient.from('store_products').insert({
    store_id: storeId,
    master_product_id: unpubProductId,
    title: 'Unpublished Test',
    slug: 'unpub-test-' + Date.now(),
    status: 'DRAFT'
  }).select('id').single();
  const storeUnpubId = storeUnpub.data!.id;

  // Set up server
  const { server, baseUrl, stop } = await setupTestServer();

  function rawFetch(path: string, options: { method?: string, headers?: any, body?: string }) {
    return new Promise<{ status: number, headers: Headers, json: () => Promise<any> }>((resolve, reject) => {
      const port = (server.address() as any).port;
      const req = http.request({
        hostname: 'localhost',
        port,
        path,
        method: options.method || 'GET',
        headers: options.headers
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const headers = new Headers();
          Object.entries(res.headers).forEach(([k, v]) => {
            if (Array.isArray(v)) v.forEach(vi => headers.append(k, vi));
            else if (v) headers.set(k, v);
          });
          resolve({
            status: res.statusCode || 200,
            headers,
            json: async () => data ? JSON.parse(data) : null
          });
        });
      });
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  try {
    // 1. Catalog Products (Public)
    console.log('[TEST] GET /api/catalog/products');
    const catRes = await rawFetch(`/api/catalog/products`, {
      headers: { Host: testDomain }
    });
    const catData = await catRes.json();
    if (catRes.status !== 200) {
       console.error('Catalog public test failed:', catData);
    }
    assert.strictEqual(catRes.status, 200, 'Catalog should be public and return 200');
    assert.ok(Array.isArray(catData.data), 'Catalog data should be an array');
    
    // Ensure the unpublished product is NOT in the array
    const unpubFound = catData.data.some((p: any) => p.storeProductId === storeUnpubId);
    assert.strictEqual(unpubFound, false, 'Unpublished product should NOT be returned by public catalog');

    // GET /api/catalog/products/:id with unpublished product -> should be 404 or empty data
    console.log('[TEST] GET /api/catalog/products/:id (unpublished)');
    const unpubRes = await rawFetch(`/api/catalog/products/${storeUnpubId}`, {
      headers: { Host: testDomain }
    });
    const unpubData = await unpubRes.json();
    assert.ok(!unpubData.data, 'Unpublished product details should return no data');

    // 2. Checkout without Cart ID -> 400
    console.log('[TEST] POST /api/checkout (missing cart_id)');
    const badReq = await rawFetch(`/api/checkout`, {
      method: 'POST',
      headers: { Host: testDomain, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(badReq.status, 400);

    // 3. Checkout with invalid Cart ID -> 404 (Not Found via DB mapped error)
    console.log('[TEST] POST /api/checkout (invalid cart_id)');
    const fakeCartId = crypto.randomUUID();
    const notFoundReq = await rawFetch(`/api/checkout`, {
      method: 'POST',
      headers: { Host: testDomain, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_id: fakeCartId })
    });
    assert.strictEqual(notFoundReq.status, 404);
    const notFoundData = await notFoundReq.json();
    assert.strictEqual(notFoundData.error.code, 'VALIDATION_ERROR');

    // 4. Guest checkout with invalid guest token -> 401
    console.log('[TEST] POST /api/checkout (invalid guest token)');
    // Let's create an actual active cart first
    const cart = await adminClient.from('carts').insert({
      store_id: storeId,
      status: 'ACTIVE',
      guest_token_hash: crypto.createHash('sha256').update('real-token').digest('hex'),
      token_expires_at: new Date(Date.now() + 86400000).toISOString()
    }).select('id').single();
    
    const guestCartId = cart.data!.id;
    const invalidGuestReq = await rawFetch(`/api/checkout`, {
      method: 'POST',
      headers: { 
        Host: testDomain, 
        'Content-Type': 'application/json',
        'x-guest-token': 'wrong-token'
      },
      body: JSON.stringify({ cart_id: guestCartId })
    });
    // The DB will throw 'invalid_guest_token' -> 401
    assert.strictEqual(invalidGuestReq.status, 401);
    const invalidGuestData = await invalidGuestReq.json();
    assert.strictEqual(invalidGuestData.error.code, 'AUTHENTICATION_ERROR');

    // 5. Checkout with empty cart -> 400
    console.log('[TEST] POST /api/checkout (empty cart)');
    const emptyGuestReq = await rawFetch(`/api/checkout`, {
      method: 'POST',
      headers: { 
        Host: testDomain, 
        'Content-Type': 'application/json',
        'x-guest-token': 'real-token'
      },
      body: JSON.stringify({ cart_id: guestCartId })
    });
    // DB throws 'empty_cart' -> 400
    assert.strictEqual(emptyGuestReq.status, 400);

    console.log('[PASS] API Checkout tests');
  } finally {
    stop();
  }
}

runApiTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
