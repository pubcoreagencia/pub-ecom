import assert from 'node:assert';
import ws from 'ws';
(global as any).WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

async function run() {
  console.log('== RUNNING ORDER EXECUTION (00016) TESTS ==');

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
    // --- 1. SETUP TENANT, SUPPLIER & PRODUCTS ---
    const orgRes = await adminClient.from('organizations').insert({ name: 'Order Org', document: crypto.randomBytes(4).toString('hex') }).select('id').single();
    if (orgRes.error) throw new Error('Org insert error: ' + JSON.stringify(orgRes.error));
    const org = orgRes.data!;

    const storeRes = await adminClient.from('stores').insert({ organization_id: org.id, name: 'Order Store', slug: 'ord-st-' + crypto.randomBytes(2).toString('hex'), status: 'ACTIVE' }).select('id').single();
    if (storeRes.error) throw new Error('Store insert error: ' + JSON.stringify(storeRes.error));
    const store = storeRes.data!;

    const suppRes = await adminClient.from('suppliers').insert({ name: 'Order Supp' }).select('id').single();
    if (suppRes.error) throw new Error('Supp insert error: ' + JSON.stringify(suppRes.error));
    const supp = suppRes.data!;

    // Product A: cost = 50.00, sale = 100.00 (Healthy Margin: 15% pub = 15.00, merchant = 35.00)
    const pA = (await adminClient.from('master_products').insert({ supplier_id: supp.id, base_sku: 'SKU-A-' + crypto.randomBytes(4).toString('hex'), name: 'Prod A' }).select('id').single()).data!;
    const skuA = 'SKU-A-V1-' + crypto.randomBytes(4).toString('hex');
    const vA = (await adminClient.from('master_product_variants').insert({ master_product_id: pA.id, sku: skuA, cost_price: 50.00 }).select('id, sku').single()).data!;
    await adminClient.from('master_inventory').insert({ master_variant_id: vA.id, on_hand: 50, reserved: 0, committed: 0 });
    const spA = (await adminClient.from('store_products').insert({ store_id: store.id, master_product_id: pA.id, title: 'Store Prod A', slug: 'spa-' + crypto.randomBytes(4).toString('hex'), status: 'PUBLISHED' }).select('id').single()).data!;
    const spvA = (await adminClient.from('store_product_variants').insert({ store_product_id: spA.id, master_variant_id: vA.id, sale_price: 100.00, is_active: true }).select('id').single()).data!;

    // Product B: cost = 100.00, sale = 110.00 (Negative Margin: gross = 10.00, pub_margin = 16.50, merchant = -6.50)
    const pB = (await adminClient.from('master_products').insert({ supplier_id: supp.id, base_sku: 'SKU-B-' + crypto.randomBytes(4).toString('hex'), name: 'Prod B' }).select('id').single()).data!;
    const vB = (await adminClient.from('master_product_variants').insert({ master_product_id: pB.id, sku: 'SKU-B-V1-' + crypto.randomBytes(4).toString('hex'), cost_price: 100.00 }).select('id').single()).data!;
    await adminClient.from('master_inventory').insert({ master_variant_id: vB.id, on_hand: 50, reserved: 0, committed: 0 });
    const spB = (await adminClient.from('store_products').insert({ store_id: store.id, master_product_id: pB.id, title: 'Store Prod B', slug: 'spb-' + crypto.randomBytes(4).toString('hex'), status: 'PUBLISHED' }).select('id').single()).data!;
    const spvB = (await adminClient.from('store_product_variants').insert({ store_product_id: spB.id, master_variant_id: vB.id, sale_price: 110.00, is_active: true }).select('id').single()).data!;

    // Customer Setup
    const { data: auth, error: authErr } = await adminClient.auth.admin.createUser({ email: `buyer-${crypto.randomBytes(4).toString('hex')}@order.test.com`, password: 'password', email_confirm: true });
    if (authErr) throw authErr;
    const buyerUser = auth.user;
    await adminClient.from('users').insert({ id: buyerUser.id, email: buyerUser.email, full_name: 'Buyer User' });
    const buyerCustomer = (await adminClient.from('customers').insert({ organization_id: org.id, user_id: buyerUser.id, email: buyerUser.email, full_name: 'Buyer Customer' }).select('id').single()).data!;

    const validAddress = {
      recipient_name: 'John Doe',
      phone: '11999999999',
      postal_code: '01001-000',
      street: 'Praça da Sé',
      number: '100',
      complement: 'Apto 1',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR'
    };

    // =========================================================================
    // TEST 1: HAPPY PATH (REGISTERED CUSTOMER) & ECONOMIC CONTRACT VERIFICATION
    // =========================================================================
    console.log('[TEST 1] Happy path registered customer');
    const cart1 = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: buyerCustomer.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: cart1.id, store_product_variant_id: spvA.id, quantity: 2 });

    const chkRes1 = await adminClient.rpc('create_checkout', {
      p_cart_id: cart1.id,
      p_store_id: store.id,
      p_customer_id: buyerCustomer.id,
      p_guest_token_hash: null
    });
    assert.ok(!chkRes1.error, `create_checkout should succeed: ${JSON.stringify(chkRes1.error)}`);
    const chk1Id = chkRes1.data;

    // Create shipping quote
    const quote1 = (await adminClient.from('shipping_quotes').insert({
      checkout_id: chk1Id,
      carrier: 'Correios',
      service_name: 'SEDEX',
      price: 25.50,
      estimated_days: 3
    }).select('id').single()).data!;

    // Initial inventory check
    const invPre1 = (await adminClient.from('master_inventory').select('*').eq('master_variant_id', vA.id).single()).data!;
    assert.strictEqual(invPre1.reserved, 2);
    assert.strictEqual(invPre1.committed, 0);

    // Call complete_checkout
    const compRes1 = await adminClient.rpc('complete_checkout', {
      p_checkout_id: chk1Id,
      p_shipping_quote_id: quote1.id,
      p_shipping_address: validAddress
    });
    assert.ok(!compRes1.error, `complete_checkout should succeed: ${JSON.stringify(compRes1.error)}`);
    const orderId1 = compRes1.data;
    assert.ok(orderId1, 'Order ID returned');

    // Verify order header
    const order1 = (await adminClient.from('orders').select('*').eq('id', orderId1).single()).data!;
    assert.strictEqual(order1.status, 'PENDING_PAYMENT');
    assert.strictEqual(order1.currency, 'BRL');
    // Total amount: (100.00 * 2) + 25.50 = 225.50
    assert.strictEqual(Number(order1.total_amount), 225.50);
    assert.strictEqual(order1.checkout_id, chk1Id);
    assert.ok(order1.order_number.startsWith('ORD-'));

    // Verify order items & economic contract
    const items1 = (await adminClient.from('order_items').select('*').eq('order_id', orderId1)).data!;
    assert.strictEqual(items1.length, 1);
    const item1 = items1[0];
    assert.strictEqual(item1.quantity, 2);
    assert.strictEqual(Number(item1.sale_price), 100.00);
    assert.strictEqual(Number(item1.cost_price), 50.00);
    // 15% take rate: ROUND(100.00 * 0.15, 2) * 2 = 30.00
    assert.strictEqual(Number(item1.pub_margin), 30.00);
    // Merchant margin: ((100.00 - 50.00) * 2) - 30.00 = 70.00
    assert.strictEqual(Number(item1.merchant_margin), 70.00);
    assert.strictEqual(item1.snapshot_sku, vA.sku);
    assert.strictEqual(item1.snapshot_name, 'Store Prod A');

    // Verify inventory transition: reserved 2 -> committed 2, on_hand untouched
    const invPost1 = (await adminClient.from('master_inventory').select('*').eq('master_variant_id', vA.id).single()).data!;
    assert.strictEqual(invPost1.reserved, 0, 'Reserved stock decremented');
    assert.strictEqual(invPost1.committed, 2, 'Committed stock incremented');
    assert.strictEqual(invPost1.on_hand, 50, 'on_hand remains unchanged');

    // Verify reservations status
    const resPost1 = (await adminClient.from('inventory_reservations').select('*').eq('checkout_id', chk1Id).single()).data!;
    assert.strictEqual(resPost1.status, 'COMMITTED');

    // Verify movements
    const move1 = (await adminClient.from('inventory_movements').select('*').eq('reference_id', orderId1).single()).data!;
    assert.strictEqual(move1.movement_type, 'COMMIT');
    assert.strictEqual(move1.quantity, 2);

    // Verify shipping line & address
    const shipLine1 = (await adminClient.from('order_shipping_lines').select('*').eq('order_id', orderId1).single()).data!;
    assert.strictEqual(shipLine1.carrier, 'Correios');
    assert.strictEqual(Number(shipLine1.charged_shipping_cost), 25.50);

    const addr1 = (await adminClient.from('order_addresses').select('*').eq('order_id', orderId1).single()).data!;
    assert.strictEqual(addr1.postal_code, '01001-000');
    assert.strictEqual(addr1.recipient_name, 'John Doe');

    // Verify checkout & cart COMPLETED
    const chkRow1 = (await adminClient.from('checkouts').select('*').eq('id', chk1Id).single()).data!;
    assert.strictEqual(chkRow1.status, 'COMPLETED');
    const cartRow1 = (await adminClient.from('carts').select('*').eq('id', cart1.id).single()).data!;
    assert.strictEqual(cartRow1.status, 'COMPLETED');

    // =========================================================================
    // TEST 2: IDEMPOTENCY (REPEATED COMPLETION RETURNS SAME ORDER)
    // =========================================================================
    console.log('[TEST 2] Idempotency: double completion returns same order');
    const compRes1Repeat = await adminClient.rpc('complete_checkout', {
      p_checkout_id: chk1Id,
      p_shipping_quote_id: quote1.id,
      p_shipping_address: validAddress
    });
    assert.ok(!compRes1Repeat.error);
    assert.strictEqual(compRes1Repeat.data, orderId1, 'Must return same order ID');

    // Verify no duplicate orders in database
    const allOrdersChk1 = (await adminClient.from('orders').select('*').eq('checkout_id', chk1Id)).data!;
    assert.strictEqual(allOrdersChk1.length, 1, 'Only 1 order exists for checkout');

    // Verify inventory not committed twice
    const invPostRepeat = (await adminClient.from('master_inventory').select('*').eq('master_variant_id', vA.id).single()).data!;
    assert.strictEqual(invPostRepeat.committed, 2, 'Committed stock must not increment twice');

    // =========================================================================
    // TEST 3: GUEST CHECKOUT COMPLETION (CREATES GUEST CUSTOMER)
    // =========================================================================
    console.log('[TEST 3] Guest checkout completion');
    const guestToken = 'guest_secret_token_123';
    const guestHash = crypto.createHash('sha256').update(guestToken).digest('hex');
    const guestCart = (await adminClient.from('carts').insert({
      store_id: store.id,
      customer_id: null,
      guest_token_hash: guestHash,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      status: 'ACTIVE'
    }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: guestCart.id, store_product_variant_id: spvA.id, quantity: 1 });

    const chkGuestRes = await adminClient.rpc('create_checkout', {
      p_cart_id: guestCart.id,
      p_store_id: store.id,
      p_customer_id: null,
      p_guest_token_hash: guestHash
    });
    assert.ok(!chkGuestRes.error);
    const guestChkId = chkGuestRes.data;

    const quoteGuest = (await adminClient.from('shipping_quotes').insert({
      checkout_id: guestChkId,
      carrier: 'Jadlog',
      service_name: '.Package',
      price: 18.00,
      estimated_days: 5
    }).select('id').single()).data!;

    const guestCustomerInfo = {
      email: 'guest.buyer@test.com',
      full_name: 'Guest Buyer',
      document: '12345678900'
    };

    const compGuestRes = await adminClient.rpc('complete_checkout', {
      p_checkout_id: guestChkId,
      p_shipping_quote_id: quoteGuest.id,
      p_shipping_address: validAddress,
      p_customer_info: guestCustomerInfo
    });
    assert.ok(!compGuestRes.error, `Guest complete should succeed: ${JSON.stringify(compGuestRes.error)}`);
    const guestOrderId = compGuestRes.data;

    const guestOrder = (await adminClient.from('orders').select('*').eq('id', guestOrderId).single()).data!;
    assert.ok(guestOrder.customer_id);

    // Verify guest customer created in organization with user_id NULL
    const createdGuestCust = (await adminClient.from('customers').select('*').eq('id', guestOrder.customer_id).single()).data!;
    assert.strictEqual(createdGuestCust.user_id, null);
    assert.strictEqual(createdGuestCust.email, 'guest.buyer@test.com');
    assert.strictEqual(createdGuestCust.organization_id, org.id);

    // =========================================================================
    // TEST 4: NEGATIVE MERCHANT MARGIN REJECTED
    // =========================================================================
    console.log('[TEST 4] Negative merchant margin rejected (cost=100, sale=110, take_rate=15%)');
    const negCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: buyerCustomer.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: negCart.id, store_product_variant_id: spvB.id, quantity: 1 });

    const chkNegRes = await adminClient.rpc('create_checkout', {
      p_cart_id: negCart.id,
      p_store_id: store.id,
      p_customer_id: buyerCustomer.id,
      p_guest_token_hash: null
    });
    assert.ok(!chkNegRes.error);
    const negChkId = chkNegRes.data;

    const quoteNeg = (await adminClient.from('shipping_quotes').insert({
      checkout_id: negChkId,
      carrier: 'Correios',
      service_name: 'PAC',
      price: 15.00,
      estimated_days: 7
    }).select('id').single()).data!;

    const compNegRes = await adminClient.rpc('complete_checkout', {
      p_checkout_id: negChkId,
      p_shipping_quote_id: quoteNeg.id,
      p_shipping_address: validAddress
    });
    assert.ok(compNegRes.error, 'Must fail for negative margin');
    assert.ok(compNegRes.error.message.includes('MERCHANT_MARGIN_NEGATIVE'), `Expected MERCHANT_MARGIN_NEGATIVE error, got: ${compNegRes.error.message}`);

    // Verify rollback: no order created, checkout still IN_PROGRESS
    const negChkRow = (await adminClient.from('checkouts').select('*').eq('id', negChkId).single()).data!;
    assert.strictEqual(negChkRow.status, 'IN_PROGRESS');
    const negOrders = (await adminClient.from('orders').select('*').eq('checkout_id', negChkId)).data!;
    assert.strictEqual(negOrders.length, 0);

    // =========================================================================
    // TEST 5: EXPIRED CHECKOUT REJECTED
    // =========================================================================
    console.log('[TEST 5] Expired checkout rejected');
    await adminClient.rpc('expire_checkout', { p_checkout_id: negChkId });

    const compExpRes = await adminClient.rpc('complete_checkout', {
      p_checkout_id: negChkId,
      p_shipping_quote_id: quoteNeg.id,
      p_shipping_address: validAddress
    });
    assert.ok(compExpRes.error);
    assert.ok(compExpRes.error.message.includes('checkout_expired'));

    // =========================================================================
    // TEST 6: CONCURRENT CONFIRMATIONS (PROMISE.ALL)
    // =========================================================================
    console.log('[TEST 6] Concurrent completion (race condition test)');
    const concCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: buyerCustomer.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: concCart.id, store_product_variant_id: spvA.id, quantity: 1 });
    const concChk = (await adminClient.rpc('create_checkout', {
      p_cart_id: concCart.id,
      p_store_id: store.id,
      p_customer_id: buyerCustomer.id,
      p_guest_token_hash: null
    })).data!;

    const concQuote = (await adminClient.from('shipping_quotes').insert({
      checkout_id: concChk,
      carrier: 'Correios',
      service_name: 'SEDEX',
      price: 20.00,
      estimated_days: 2
    }).select('id').single()).data!;

    const [c1, c2] = await Promise.all([
      adminClient.rpc('complete_checkout', { p_checkout_id: concChk, p_shipping_quote_id: concQuote.id, p_shipping_address: validAddress }),
      adminClient.rpc('complete_checkout', { p_checkout_id: concChk, p_shipping_quote_id: concQuote.id, p_shipping_address: validAddress })
    ]);

    assert.ok(!c1.error, `c1 error: ${JSON.stringify(c1.error)}`);
    assert.ok(!c2.error, `c2 error: ${JSON.stringify(c2.error)}`);
    assert.strictEqual(c1.data, c2.data, 'Both concurrent calls must resolve to the identical order ID');

    const concOrders = (await adminClient.from('orders').select('*').eq('checkout_id', concChk)).data!;
    assert.strictEqual(concOrders.length, 1, 'Exactly one order created');

    // =========================================================================
    // TEST 7: SNAPSHOT INTEGRITY (CATALOG PRICE CHANGE DOES NOT ALTER ORDER ITEM)
    // =========================================================================
    console.log('[TEST 7] Snapshot integrity when catalog changes');
    // Change catalog price of spvA from 100.00 to 999.00
    await adminClient.from('store_product_variants').update({ sale_price: 999.00 }).eq('id', spvA.id);

    const frozenItem = (await adminClient.from('order_items').select('*').eq('order_id', orderId1).single()).data!;
    assert.strictEqual(Number(frozenItem.sale_price), 100.00, 'Original order sale_price must remain 100.00');
    assert.strictEqual(Number(frozenItem.pub_margin), 30.00, 'Original order pub_margin must remain 30.00');
    assert.strictEqual(Number(frozenItem.merchant_margin), 70.00, 'Original order merchant_margin must remain 70.00');

    // Restore catalog price
    await adminClient.from('store_product_variants').update({ sale_price: 100.00 }).eq('id', spvA.id);

    // =========================================================================
    // TEST 8: ATOMIC ROLLBACK TEST
    // =========================================================================
    console.log('[TEST 8] Rollback test on invalid address payload');
    const rollCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: buyerCustomer.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: rollCart.id, store_product_variant_id: spvA.id, quantity: 1 });
    const rollChk = (await adminClient.rpc('create_checkout', {
      p_cart_id: rollCart.id,
      p_store_id: store.id,
      p_customer_id: buyerCustomer.id,
      p_guest_token_hash: null
    })).data!;

    const rollQuote = (await adminClient.from('shipping_quotes').insert({
      checkout_id: rollChk,
      carrier: 'Correios',
      service_name: 'SEDEX',
      price: 20.00,
      estimated_days: 2
    }).select('id').single()).data!;

    const invalidAddress = { ...validAddress, postal_code: '' }; // Missing postal code
    const rollRes = await adminClient.rpc('complete_checkout', {
      p_checkout_id: rollChk,
      p_shipping_quote_id: rollQuote.id,
      p_shipping_address: invalidAddress
    });
    assert.ok(rollRes.error);
    assert.ok(rollRes.error.message.includes('invalid_shipping_address'));

    // Verify complete rollback
    const rollOrders = (await adminClient.from('orders').select('*').eq('checkout_id', rollChk)).data!;
    assert.strictEqual(rollOrders.length, 0, 'No order persisted');
    const rollChkRow = (await adminClient.from('checkouts').select('*').eq('id', rollChk).single()).data!;
    assert.strictEqual(rollChkRow.status, 'IN_PROGRESS', 'Checkout remains IN_PROGRESS');
    const rollCartRow = (await adminClient.from('carts').select('*').eq('id', rollCart.id).single()).data!;
    assert.strictEqual(rollCartRow.status, 'IN_PROGRESS', 'Cart remains IN_PROGRESS');

    // =========================================================================
    // TEST 9: VALID MARGIN BOUNDARY (sale = 117.65, cost = 100)
    // =========================================================================
    console.log('[TEST 9] Valid margin boundary test');
    // cost = 100. sale = 117.65.
    // gross = 17.65.
    // pub_margin = ROUND(117.65 * 0.15, 2) = 17.65.
    // merchant_margin = 17.65 - 17.65 = 0.00 >= 0 (VALID)
    const spvBound = (await adminClient.from('store_product_variants').insert({ store_product_id: spB.id, master_variant_id: vB.id, sale_price: 117.65, is_active: true }).select('id').single()).data!;
    const boundCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: buyerCustomer.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: boundCart.id, store_product_variant_id: spvBound.id, quantity: 1 });
    const boundChk = (await adminClient.rpc('create_checkout', { p_cart_id: boundCart.id, p_store_id: store.id, p_customer_id: buyerCustomer.id, p_guest_token_hash: null })).data!;
    const boundQuote = (await adminClient.from('shipping_quotes').insert({ checkout_id: boundChk, carrier: 'Correios', service_name: 'SEDEX', price: 10.00, estimated_days: 1 }).select('id').single()).data!;

    const boundRes = await adminClient.rpc('complete_checkout', {
      p_checkout_id: boundChk,
      p_shipping_quote_id: boundQuote.id,
      p_shipping_address: validAddress
    });
    assert.ok(!boundRes.error, `Boundary check should succeed: ${JSON.stringify(boundRes.error)}`);
    const boundItem = (await adminClient.from('order_items').select('*').eq('order_id', boundRes.data).single()).data!;
    assert.strictEqual(Number(boundItem.pub_margin), 17.65);
    assert.strictEqual(Number(boundItem.merchant_margin), 0.00);

    // =========================================================================
    // TEST 10: RESERVATION MISMATCH REJECTED
    // =========================================================================
    console.log('[TEST 10] Reservation mismatch rejected');
    const misCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: buyerCustomer.id, status: 'ACTIVE' }).select('id').single()).data!;
    await adminClient.from('cart_items').insert({ cart_id: misCart.id, store_product_variant_id: spvA.id, quantity: 2 });
    const misChk = (await adminClient.rpc('create_checkout', { p_cart_id: misCart.id, p_store_id: store.id, p_customer_id: buyerCustomer.id, p_guest_token_hash: null })).data!;
    const misQuote = (await adminClient.from('shipping_quotes').insert({ checkout_id: misChk, carrier: 'Correios', service_name: 'SEDEX', price: 10.00, estimated_days: 1 }).select('id').single()).data!;
    // Tamper reservation: change quantity from 2 to 1
    await adminClient.from('inventory_reservations').update({ quantity: 1 }).eq('checkout_id', misChk);

    const misRes = await adminClient.rpc('complete_checkout', {
      p_checkout_id: misChk,
      p_shipping_quote_id: misQuote.id,
      p_shipping_address: validAddress
    });
    assert.ok(misRes.error);
    assert.ok(misRes.error.message.includes('reservation_mismatch'));

    // =========================================================================
    // TEST 11: BROKEN INVARIANT (COMPLETED CHECKOUT WITHOUT ORDER)
    // =========================================================================
    console.log('[TEST 11] Broken invariant: COMPLETED checkout without order fails');
    const invCart = (await adminClient.from('carts').insert({ store_id: store.id, customer_id: buyerCustomer.id, status: 'COMPLETED' }).select('id').single()).data!;
    const invChk = (await adminClient.from('checkouts').insert({ cart_id: invCart.id, store_id: store.id, status: 'COMPLETED' }).select('id').single()).data!;
    const invQuote = (await adminClient.from('shipping_quotes').insert({ checkout_id: invChk.id, carrier: 'Correios', service_name: 'SEDEX', price: 10.00, estimated_days: 1 }).select('id').single()).data!;

    const invRes = await adminClient.rpc('complete_checkout', {
      p_checkout_id: invChk.id,
      p_shipping_quote_id: invQuote.id,
      p_shipping_address: validAddress
    });
    assert.ok(invRes.error);
    assert.ok(invRes.error.message.includes('invariant_violation_completed_checkout_without_order'));

    // =========================================================================
    // TEST 12: TENANT ISOLATION (CROSS-ORG CART/STORE MISMATCH)
    // =========================================================================
    console.log('[TEST 12] Tenant isolation enforcement');
    const orgOther = (await adminClient.from('organizations').insert({ name: 'Other Org', document: crypto.randomBytes(4).toString('hex') }).select('id').single()).data!;
    const storeOther = (await adminClient.from('stores').insert({ organization_id: orgOther.id, name: 'Other Store', slug: 'oth-' + crypto.randomBytes(2).toString('hex'), status: 'ACTIVE' }).select('id').single()).data!;
    // Cart from storeOther cannot be completed in store
    const crossCart = (await adminClient.from('carts').insert({ store_id: storeOther.id, customer_id: buyerCustomer.id, status: 'ACTIVE' }).select('id').single()).data!;
    const crossChk = (await adminClient.from('checkouts').insert({ cart_id: crossCart.id, store_id: storeOther.id, status: 'IN_PROGRESS' }).select('id').single()).data!;
    const crossQuote = (await adminClient.from('shipping_quotes').insert({ checkout_id: crossChk.id, carrier: 'Correios', service_name: 'SEDEX', price: 10.00, estimated_days: 1 }).select('id').single()).data!;

    // BuyerCustomer belongs to `org`, whereas `storeOther` belongs to `orgOther` -> unauthorized_customer
    const crossRes = await adminClient.rpc('complete_checkout', {
      p_checkout_id: crossChk.id,
      p_shipping_quote_id: crossQuote.id,
      p_shipping_address: validAddress
    });
    assert.ok(crossRes.error);
    assert.ok(crossRes.error.message.includes('unauthorized_customer'));

    console.log('== ALL 00016 ORDER EXECUTION TESTS PASSED SUCCESSFULLY ==');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();
