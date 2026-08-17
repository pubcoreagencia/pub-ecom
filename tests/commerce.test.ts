import assert from 'node:assert';
import ws from 'ws';
(global as any).WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

import { withStoreContext } from '../src/api/middleware';
import { handleCustomerRequest } from '../src/api/handlers/customer';
import { handleGuestCartRequest, handleAuthCartRequest } from '../src/api/handlers/cart';

async function run() {
  console.log('== RUNNING COMMERCE API/EDGE TESTS ==');

  const SUPABASE_URL = 'http://localhost:54321';
  let SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    const { execSync } = require('child_process');
    const statusStr = execSync('npx supabase status -o json').toString();
    const jsonStr = statusStr.substring(statusStr.indexOf('{'));
    const status = JSON.parse(jsonStr);
    SUPABASE_ANON_KEY = status.ANON_KEY;
    SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  }
  
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY;

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  
  try {
    // --- SETUP FIXTURES ---
    const { data: adminAuth, error: authErr } = await adminClient.auth.admin.createUser({ email: `owner-${crypto.randomBytes(4).toString('hex')}@commerce.test.com`, password: 'password', email_confirm: true });
    if (authErr) throw authErr;
    const adminUser = adminAuth.user;
    await adminClient.from('users').insert({ id: adminUser.id, email: adminUser.email, full_name: 'Admin User' });

    const { data: custAuth, error: custErr } = await adminClient.auth.admin.createUser({ email: `cust-${crypto.randomBytes(4).toString('hex')}@commerce.test.com`, password: 'password', email_confirm: true });
    if (custErr) throw custErr;
    const custUser = custAuth.user;
    await adminClient.from('users').insert({ id: custUser.id, email: custUser.email, full_name: 'Cust User' });

    const { data: otherUserAuth, error: outhErr } = await adminClient.auth.admin.createUser({ email: `other-${crypto.randomBytes(4).toString('hex')}@commerce.test.com`, password: 'password', email_confirm: true });
    if (outhErr) throw outhErr;
    const otherUser = otherUserAuth.user;
    await adminClient.from('users').insert({ id: otherUser.id, email: otherUser.email, full_name: 'Other User' });

    const insertOrgA = await adminClient.from('organizations').insert({ name: 'Commerce Org', document: crypto.randomBytes(4).toString('hex') }).select('id').single();
    const orgA = insertOrgA.data!;
    
    await adminClient.from('memberships').insert({ user_id: adminUser.id, organization_id: orgA.id, role: 'OWNER' });

    const insertStoreA = await adminClient.from('stores').insert({ organization_id: orgA.id, name: 'Store A', slug: 'st-a' + crypto.randomBytes(2).toString('hex'), status: 'ACTIVE' }).select('id').single();
    const storeA = insertStoreA.data!;

    const storeDomainStr = 'testdomain-' + crypto.randomBytes(4).toString('hex') + '.com';
    await adminClient.from('store_domains').insert({ store_id: storeA.id, domain: storeDomainStr });

    const insertSupp = await adminClient.from('suppliers').insert({ name: 'Supp' }).select('id').single();
    const supp = insertSupp.data!;
    
    const insertMastP1 = await adminClient.from('master_products').insert({ supplier_id: supp.id, base_sku: 'SKU1' + crypto.randomBytes(2).toString('hex'), name: 'P1' }).select('id').single();
    const mastP1 = insertMastP1.data!;
    
    const insertMastV1 = await adminClient.from('master_product_variants').insert({ master_product_id: mastP1.id, sku: 'SKU1-V' + crypto.randomBytes(2).toString('hex') }).select('id').single();
    const mastV1 = insertMastV1.data!;
    
    const insertSpA = await adminClient.from('store_products').insert({ store_id: storeA.id, master_product_id: mastP1.id, title: 'P1A', slug: 'p1a' + crypto.randomBytes(2).toString('hex'), status: 'PUBLISHED' }).select('id').single();
    const spA = insertSpA.data!;
    
    const EXPECTED_SALE_PRICE = 1500;
    const insertSpv1 = await adminClient.from('store_product_variants').insert({ store_product_id: spA.id, master_variant_id: mastV1.id, sale_price: EXPECTED_SALE_PRICE }).select('id').single();
    const spv1 = insertSpv1.data!;

    // Obtain access tokens for authenticated tests
    const { data: custLogin } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY!).auth.signInWithPassword({ email: custUser.email!, password: 'password' });
    const custToken = custLogin.session?.access_token;
    
    const { data: otherLogin } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY!).auth.signInWithPassword({ email: otherUser.email!, password: 'password' });
    const otherToken = otherLogin.session?.access_token;

    const wrappedCustomerHandler = withStoreContext(handleCustomerRequest);
    const wrappedGuestCartHandler = withStoreContext(handleGuestCartRequest);
    const wrappedAuthCartHandler = withStoreContext(handleAuthCartRequest);

    // --- TEST 1,2,3,4: STORE RESOLUTION ---
    console.log('[TEST] Store Resolution');
    let res = await wrappedCustomerHandler(new Request(`http://${storeDomainStr}/`, { method: 'GET' }));
    // Wait, the handler fails with 401 because customer handler expects auth. But the middleware resolved the store properly.
    assert.strictEqual(res.status, 401, 'Expected 401 unauthorized because store resolved but no customer session');
    
    res = await wrappedCustomerHandler(new Request(`http://invalid-domain.com/`, { method: 'GET' }));
    assert.strictEqual(res.status, 404, 'Expected 404 validation error for invalid domain');
    let errBody = await res.json();
    assert.strictEqual(errBody.error?.code, 'VALIDATION_ERROR');

    // --- TEST 5,6,7,8: CUSTOMER API ---
    console.log('[TEST] Customer API');
    res = await wrappedCustomerHandler(new Request(`http://${storeDomainStr}/`, { 
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` },
      body: JSON.stringify({ email: custUser.email, full_name: 'Cust API Name' })
    }));
    assert.strictEqual(res.status, 201, 'Customer create should succeed');
    
    res = await wrappedCustomerHandler(new Request(`http://${storeDomainStr}/`, { 
      method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    }));
    let body = await res.json();
    assert.strictEqual(res.status, 200, 'Customer retrieve should succeed');
    assert.strictEqual(body.data.full_name, 'Cust API Name');
    
    // Cross-user denied (other user accessing)
    res = await wrappedCustomerHandler(new Request(`http://${storeDomainStr}/`, { 
      method: 'GET',
      headers: { 'Authorization': `Bearer ${otherToken}` }
    }));
    assert.strictEqual(res.status, 404, 'Other user should not have customer profile in this store');

    // --- TEST 9,10,11,12,13: GUEST CART ---
    console.log('[TEST] Guest Cart');
    res = await wrappedGuestCartHandler(new Request(`http://${storeDomainStr}/api/guest-cart`, { method: 'POST' }));
    body = await res.json();
    assert.strictEqual(res.status, 201, 'Guest cart creation should succeed');
    const guestCartId = body.data.cart_id;
    const guestToken = body.data.guest_token;
    assert.ok(guestToken, 'Guest token should be returned');
    assert.ok(!guestToken.includes('$'), 'Raw token returned should NOT be a hash'); // Security Test 33
    
    // Add item
    res = await wrappedGuestCartHandler(new Request(`http://${storeDomainStr}/api/guest-cart/items`, {
      method: 'POST',
      headers: { 'x-guest-token': guestToken },
      body: JSON.stringify({ variant_id: spv1.id, quantity: 2 })
    }));
    body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.data.items[0].quantity, 2);
    
    // Test 22, 23, 24, 25: Pricing Test on Add
    assert.strictEqual(body.data.items[0].salePrice, EXPECTED_SALE_PRICE, 'Pricing derives from DB');
    assert.strictEqual(body.data.items[0].lineTotal, EXPECTED_SALE_PRICE * 2, 'Line total correct');
    assert.strictEqual(body.data.subtotal, EXPECTED_SALE_PRICE * 2, 'Subtotal correct');
    assert.strictEqual(body.data.total, EXPECTED_SALE_PRICE * 2, 'Total correct');
    
    // Invalid token (Test 14)
    res = await wrappedGuestCartHandler(new Request(`http://${storeDomainStr}/api/guest-cart`, {
      method: 'GET',
      headers: { 'x-guest-token': 'wrongtoken' }
    }));
    assert.strictEqual(res.status, 404);

    // --- TEST 17,18,19,20: AUTH CART ---
    console.log('[TEST] Auth Cart');
    // Add auth item
    res = await wrappedAuthCartHandler(new Request(`http://${storeDomainStr}/api/cart/items`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` },
      body: JSON.stringify({ variant_id: spv1.id, quantity: 1 })
    }));
    body = await res.json();
    assert.strictEqual(res.status, 200, 'Auth cart add should succeed');
    assert.strictEqual(body.data.items[0].quantity, 1);
    
    // --- TEST 26,27,28,29: MERGE ---
    console.log('[TEST] Merge');
    // We have guest cart (qty 2) and auth cart (qty 1). Merge should result in qty 3.
    res = await wrappedAuthCartHandler(new Request(`http://${storeDomainStr}/api/cart/merge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` },
      body: JSON.stringify({ guest_cart_id: guestCartId, guest_token: guestToken })
    }));
    body = await res.json();
    if (res.status !== 200) console.error('Merge Failed:', body);
    assert.strictEqual(res.status, 200, 'Merge should succeed');
    assert.strictEqual(body.data.items[0].quantity, 3, 'Merge should sum duplicate variants');
    
    // Guest cart should now be consumed (Test 31)
    res = await wrappedGuestCartHandler(new Request(`http://${storeDomainStr}/api/guest-cart`, {
      method: 'GET',
      headers: { 'x-guest-token': guestToken }
    }));
    assert.strictEqual(res.status, 404, 'Guest cart should be consumed after merge');

    // Security Tests: check response payload for ANY service_role key leakage (Test 35)
    const jsonStrResponse = JSON.stringify(body);
    assert.ok(!jsonStrResponse.includes(SUPABASE_SERVICE_ROLE_KEY!), 'Service role key leaked in response');

    console.log('Commerce API Edge test suite PASSED');
    process.exit(0);

  } catch(e) {
    console.error('Failed:', e);
    process.exit(1);
  }
}

run();
