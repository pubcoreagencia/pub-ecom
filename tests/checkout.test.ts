import assert from 'node:assert';
import ws from 'ws';
(global as any).WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

async function run() {
  console.log('== RUNNING CHECKOUT TRANSACTIONS TESTS ==');

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

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  
  try {
    // --- SETUP FIXTURES ---
    const { data: auth, error: authErr } = await adminClient.auth.admin.createUser({ email: `cust-${crypto.randomBytes(4).toString('hex')}@checkout.test.com`, password: 'password', email_confirm: true });
    if (authErr) throw authErr;
    const custUser = auth.user;
    await adminClient.from('users').insert({ id: custUser.id, email: custUser.email, full_name: 'Cust User' });

    const { data: auth2, error: auth2Err } = await adminClient.auth.admin.createUser({ email: `other-${crypto.randomBytes(4).toString('hex')}@checkout.test.com`, password: 'password', email_confirm: true });
    if (auth2Err) throw auth2Err;
    const otherUser = auth2.user;
    await adminClient.from('users').insert({ id: otherUser.id, email: otherUser.email, full_name: 'Other User' });

    const org = (await adminClient.from('organizations').insert({ name: 'Org A', document: crypto.randomBytes(4).toString('hex') }).select('id').single()).data!;
    const orgB = (await adminClient.from('organizations').insert({ name: 'Org B', document: crypto.randomBytes(4).toString('hex') }).select('id').single()).data!;
    
    await adminClient.from('customers').insert({ id: custUser.id, organization_id: org.id, user_id: custUser.id, email: custUser.email });
    await adminClient.from('customers').insert({ id: otherUser.id, organization_id: orgB.id, user_id: otherUser.id, email: otherUser.email });

    const store = (await adminClient.from('stores').insert({ organization_id: org.id, name: 'Store A', slug: 'st-a' + crypto.randomBytes(2).toString('hex'), status: 'ACTIVE' }).select('id').single()).data!;
    
    const supp = (await adminClient.from('suppliers').insert({ name: 'Supp' }).select('id').single()).data!;
    
    // Product 1 - Valid, in stock
    const mastP1 = (await adminClient.from('master_products').insert({ supplier_id: supp.id, base_sku: 'SKU1' + crypto.randomBytes(2).toString('hex'), name: 'P1' }).select('id').single()).data!;
    const mastV1 = (await adminClient.from('master_product_variants').insert({ master_product_id: mastP1.id, sku: 'SKU1-V' + crypto.randomBytes(2).toString('hex') }).select('id').single()).data!;
    
    // Add stock
    await adminClient.from('master_inventory').insert({ master_variant_id: mastV1.id, on_hand: 10, reserved: 0, committed: 0 });
    
    const sp1 = (await adminClient.from('store_products').insert({ store_id: store.id, master_product_id: mastP1.id, title: 'P1A', slug: 'p1a' + crypto.randomBytes(2).toString('hex'), status: 'PUBLISHED' }).select('id').single()).data!;
    const spv1 = (await adminClient.from('store_product_variants').insert({ store_product_id: sp1.id, master_variant_id: mastV1.id, sale_price: 1500, is_active: true }).select('id').single()).data!;

    // Product 2 - Unpublished
    const mastP2 = (await adminClient.from('master_products').insert({ supplier_id: supp.id, base_sku: 'SKU2' + crypto.randomBytes(2).toString('hex'), name: 'P2' }).select('id').single()).data!;
    const mastV2 = (await adminClient.from('master_product_variants').insert({ master_product_id: mastP2.id, sku: 'SKU2-V' + crypto.randomBytes(2).toString('hex') }).select('id').single()).data!;
    await adminClient.from('master_inventory').insert({ master_variant_id: mastV2.id, on_hand: 10, reserved: 0, committed: 0 });
    const sp2 = (await adminClient.from('store_products').insert({ store_id: store.id, master_product_id: mastP2.id, title: 'P2A', slug: 'p2a' + crypto.randomBytes(2).toString('hex'), status: 'DRAFT' }).select('id').single()).data!;
    const spv2 = (await adminClient.from('store_product_variants').insert({ store_product_id: sp2.id, master_variant_id: mastV2.id, sale_price: 1500, is_active: true }).select('id').single()).data!;

    const { data: custLogin } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY!).auth.signInWithPassword({ email: custUser.email!, password: 'password' });
    const custClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${custLogin.session?.access_token}` } } });

    console.log('[TEST] Create valid cart');
    const authCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: custUser.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: authCart.id, store_product_variant_id: spv1.id, quantity: 2 });

    console.log('[TEST] Authenticated Customer Creates Checkout');
    const res1 = await custClient.rpc('create_checkout', {
      p_cart_id: authCart.id,
      p_store_id: store.id,
      p_customer_id: custUser.id,
      p_guest_token_hash: null
    });
    assert.ok(!res1.error, `Should succeed: ${JSON.stringify(res1.error)}`);
    const checkoutId = res1.data;
    assert.ok(checkoutId, 'Checkout ID returned');

    const checkoutRow = (await adminClient.from('checkouts').select('*').eq('id', checkoutId).single()).data;
    assert.strictEqual(checkoutRow.status, 'IN_PROGRESS', 'Checkout row created with correct status');

    const cartRow = (await adminClient.from('carts').select('*').eq('id', authCart.id).single()).data;
    assert.strictEqual(cartRow.status, 'IN_PROGRESS', 'Cart transitioned to IN_PROGRESS');

    const reservations = (await adminClient.from('inventory_reservations').select('*').eq('checkout_id', checkoutId)).data!;
    assert.strictEqual(reservations.length, 1, 'Reservation created');
    assert.strictEqual(reservations[0].quantity, 2, 'Reservation quantity correct');
    assert.strictEqual(reservations[0].status, 'ACTIVE');

    const inv = (await adminClient.from('master_inventory').select('*').eq('master_variant_id', mastV1.id).single()).data!;
    assert.strictEqual(inv.reserved, 2, 'Reserved correctly decremented available stock implicitly via reserved++');

    const moves = (await adminClient.from('inventory_movements').select('*').eq('reference_id', checkoutId)).data!;
    assert.strictEqual(moves.length, 1);
    assert.strictEqual(moves[0].movement_type, 'RESERVE');

    console.log('[TEST] Active checkout already exists rejected');
    const res2 = await custClient.rpc('create_checkout', { p_cart_id: authCart.id, p_store_id: store.id, p_customer_id: custUser.id, p_guest_token_hash: null });
    assert.ok(res2.error && res2.error.message.includes('active_checkout_exists'), 'Should raise active_checkout_exists');

    console.log('[TEST] Expire Checkout via Service Role');
    const expRes = await adminClient.rpc('expire_checkout', { p_checkout_id: checkoutId });
    assert.ok(!expRes.error, `Should expire successfully: ${expRes.error}`);
    
    const postExpChk = (await adminClient.from('checkouts').select('*').eq('id', checkoutId).single()).data!;
    assert.strictEqual(postExpChk.status, 'EXPIRED');

    const postExpInv = (await adminClient.from('master_inventory').select('*').eq('master_variant_id', mastV1.id).single()).data!;
    assert.strictEqual(postExpInv.reserved, 0, 'Reservation released exactly once');

    const postExpRes = (await adminClient.from('inventory_reservations').select('*').eq('checkout_id', checkoutId).single()).data!;
    assert.strictEqual(postExpRes.status, 'RELEASED');
    assert.ok(postExpRes.released_at);

    const postExpCart = (await adminClient.from('carts').select('*').eq('id', authCart.id).single()).data!;
    assert.strictEqual(postExpCart.status, 'ACTIVE', 'Cart returns to ACTIVE');

    const movesRelease = (await adminClient.from('inventory_movements').select('*').eq('reference_id', checkoutId).eq('movement_type', 'RELEASE')).data!;
    assert.strictEqual(movesRelease.length, 1, 'RELEASE movement created');

    console.log('[TEST] Repeated expire_checkout cannot double-release');
    await adminClient.rpc('expire_checkout', { p_checkout_id: checkoutId });
    const postExpInv2 = (await adminClient.from('master_inventory').select('*').eq('master_variant_id', mastV1.id).single()).data;
    assert.strictEqual(postExpInv2.reserved, 0, 'Stock did not decrement twice');

    console.log('[TEST] Empty Cart Rejected');
    const emptyCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: custUser.id, status: 'ACTIVE' }).select('id').single()).data!;
    const res3 = await custClient.rpc('create_checkout', { p_cart_id: emptyCart.id, p_store_id: store.id, p_customer_id: custUser.id, p_guest_token_hash: null });
    assert.ok(res3.error && res3.error.message.includes('empty_cart'));

    console.log('[TEST] Insufficient Stock Rejected');
    const noStockCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: custUser.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: noStockCart.id, store_product_variant_id: spv1.id, quantity: 20 });
    const res4 = await custClient.rpc('create_checkout', { p_cart_id: noStockCart.id, p_store_id: store.id, p_customer_id: custUser.id, p_guest_token_hash: null });
    assert.ok(res4.error && res4.error.message.includes('insufficient_stock'));
    
    console.log('[TEST] Unpublished Product Rejected');
    const draftCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: custUser.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: draftCart.id, store_product_variant_id: spv2.id, quantity: 1 });
    const res5 = await custClient.rpc('create_checkout', { p_cart_id: draftCart.id, p_store_id: store.id, p_customer_id: custUser.id, p_guest_token_hash: null });
    assert.ok(res5.error && res5.error.message.includes('unavailable_variant'));

    console.log('[TEST] Store Mismatch Rejected');
    const res6 = await custClient.rpc('create_checkout', { p_cart_id: authCart.id, p_store_id: supp.id, p_customer_id: custUser.id, p_guest_token_hash: null }); // Bad store_id
    assert.ok(res6.error && res6.error.message.includes('store_mismatch'));

    console.log('[TEST] Valid Guest creates checkout');
    const guestHash = crypto.createHash('sha256').update('token123').digest('hex');
    const guestCart = (await adminClient.from('carts').insert({ store_id: store.id, guest_token_hash: guestHash, token_expires_at: new Date(Date.now() + 10000).toISOString(), status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: guestCart.id, store_product_variant_id: spv1.id, quantity: 1 });
    const res7 = await adminClient.rpc('create_checkout', { p_cart_id: guestCart.id, p_store_id: store.id, p_customer_id: null, p_guest_token_hash: guestHash });
    assert.ok(!res7.error, `Guest checkout should succeed: ${res7.error}`);

    console.log('[TEST] Invalid guest token rejected');
    const guestCart2 = (await adminClient.from('carts').insert({ store_id: store.id, guest_token_hash: guestHash, token_expires_at: new Date(Date.now() + 10000).toISOString(), status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: guestCart2.id, store_product_variant_id: spv1.id, quantity: 1 });
    const res8 = await adminClient.rpc('create_checkout', { p_cart_id: guestCart2.id, p_store_id: store.id, p_customer_id: null, p_guest_token_hash: 'badhash' });
    assert.ok(res8.error && res8.error.message.includes('invalid_guest_token'));

    console.log('== ALL TESTS PASSED ==');
    process.exit(0);
  } catch (err) {
    console.error('Test failed', err);
    process.exit(1);
  }
}

run();
