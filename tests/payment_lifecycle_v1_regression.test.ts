import assert from 'node:assert';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { CredentialCipher } from '../src/lib/crypto/credentials';

async function getClient() {
  const url = 'http://127.0.0.1:54321';
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    const raw = execSync('npx supabase status -o json').toString();
    const status = JSON.parse(raw.substring(raw.indexOf('{')));
    key = status.SERVICE_ROLE_KEY;
  }
  if (!key) throw new Error('SERVICE_ROLE_KEY unavailable');
  return createClient<Database>(url, key!, { auth: { persistSession: false } });
}

async function run() {
  console.log('== RUNNING PAYMENT LIFECYCLE V1 REGRESSION TESTS ==');
  const client = await getClient();
  const cipher = new CredentialCipher();

  const suffix = crypto.randomBytes(6).toString('hex');
  const org = (await client.from('organizations').insert({
    name: 'Lifecycle Regression Org',
    document: 'LIFE' + suffix
  }).select('id').single()).data;
  if (!org) throw new Error('org setup failed');

  const store = (await client.from('stores').insert({
    organization_id: org!.id,
    name: 'Lifecycle Regression Store',
    slug: 'life-' + suffix,
    status: 'ACTIVE'
  }).select('id').single()).data;
  if (!store) throw new Error('store setup failed');

  const customer = (await client.from('customers').insert({
    organization_id: org!.id,
    email: 'life-' + suffix + '@pub.test',
    full_name: 'Lifecycle Regression Customer'
  }).select('id').single()).data;
  if (!customer) throw new Error('customer setup failed');

  await client.from('gateway_providers').upsert({
    id: 'asaas',
    display_name: 'Asaas Provider',
    is_active: true
  });

  const connection = (await client.from('gateway_connections').insert({
    organization_id: org!.id,
    provider_id: 'asaas',
    environment: 'SANDBOX',
    status: 'ACTIVE',
    is_global_default: false,
    encrypted_credentials: cipher.encrypt({ apiKey: 'REGRESSION_TEST_KEY' })
  }).select('id').single()).data;
  if (!connection) throw new Error('connection setup failed');

  const supplier = (await client.from('suppliers').insert({
    name: 'Lifecycle Regression Supplier'
  }).select('id').single()).data;
  if (!supplier) throw new Error('supplier setup failed');

  const product = (await client.from('master_products').insert({
    supplier_id: supplier!.id,
    base_sku: 'LIFE-BASE-' + suffix,
    name: 'Lifecycle Regression Product'
  }).select('id').single()).data;
  if (!product) throw new Error('product setup failed');

  const variant = (await client.from('master_product_variants').insert({
    master_product_id: product!.id,
    sku: 'LIFE-SKU-' + suffix,
    cost_price: 10
  }).select('id').single()).data;
  if (!variant) throw new Error('variant setup failed');

  const invInsert = await client.from('master_inventory').insert({
    master_variant_id: variant!.id,
    on_hand: 20,
    reserved: 4,
    committed: 0
  });
  assert.ok(!invInsert.error, invInsert.error?.message ?? 'inventory insert failed');

  const orders: string[] = [];
  const payments: string[] = [];
  const txs: string[] = [];
  const reservations: string[] = [];
  const checkouts: string[] = [];
  const carts: string[] = [];

  async function fixture(tag: string) {
    const cart = (await client.from('carts').insert({
      store_id: store!.id,
      customer_id: customer!.id,
      status: 'COMPLETED'
    }).select('id').single()).data;
    if (!cart) throw new Error('cart setup failed');
    carts.push(cart!.id);

    const checkout = (await client.from('checkouts').insert({
      cart_id: cart!.id,
      store_id: store!.id,
      status: 'COMPLETED'
    }).select('id').single()).data;
    if (!checkout) throw new Error('checkout setup failed');
    checkouts.push(checkout!.id);

    const reservation = (await client.from('inventory_reservations').insert({
      master_variant_id: variant!.id,
      checkout_id: checkout!.id,
      quantity: 2,
      status: 'ACTIVE',
      expires_at: new Date(Date.now() + 900000).toISOString()
    }).select('id').single()).data;
    if (!reservation) throw new Error('reservation setup failed');
    reservations.push(reservation!.id);

    const order = (await client.from('orders').insert({
      organization_id: org!.id,
      store_id: store!.id,
      customer_id: customer!.id,
      checkout_id: checkout!.id,
      order_number: 'LIFE-' + tag + '-' + Date.now(),
      status: 'PENDING_PAYMENT',
      total_amount: 100,
      currency: 'BRL'
    }).select('id').single()).data;
    if (!order) throw new Error('order setup failed');
    orders.push(order!.id);

    const payment = (await client.from('payments').insert({
      order_id: order!.id,
      provider: 'asaas',
      gross_amount: 100,
      currency: 'BRL',
      status: 'PENDING',
      payment_method: 'PIX'
    }).select('id').single()).data;
    if (!payment) throw new Error('payment setup failed');
    payments.push(payment!.id);

    const tx = (await client.from('payment_transactions').insert({
      payment_id: payment!.id,
      gateway_connection_id: connection!.id,
      provider: 'asaas',
      idempotency_key: 'LIFE-' + tag + '-' + Date.now(),
      type: 'PAY',
      amount: 100,
      status: 'PROCESSING',
      transaction_id_external: 'pay-life-' + tag
    }).select('id').single()).data;
    if (!tx) throw new Error('tx setup failed');
    txs.push(tx!.id);

    return { checkout: checkout!.id, reservation: reservation!.id, order: order!.id, payment: payment!.id, tx: tx!.id };
  }

  try {
    const a = await fixture('A');
    const rejected = await client.rpc('settle_payment_lifecycle', {
      p_payment_id: a.payment,
      p_transaction_id: a.tx,
      p_connection_id: connection!.id,
      p_transaction_id_external: 'pay-life-A',
      p_verified_amount: 100,
      p_verified_currency: 'BRL',
      p_gateway_fee: 0,
      p_net_amount: 0,
      p_verified_outcome: 'REJECTED'
    });
    assert.ok(!rejected.error, rejected.error?.message ?? 'rejected settlement failed');
    assert.strictEqual(rejected.data, false);

    const invA = (await client.from('master_inventory')
      .select('reserved, committed')
      .eq('master_variant_id', variant!.id).single()).data;
    assert.deepStrictEqual(invA, { reserved: 4, committed: 0 });

    const resA = (await client.from('inventory_reservations')
      .select('status').eq('id', a.reservation).single()).data;
    assert.strictEqual(resA?.status, 'ACTIVE');

    const ordA = (await client.from('orders')
      .select('status').eq('id', a.order).single()).data;
    assert.strictEqual(ordA?.status, 'PENDING_PAYMENT');
    console.log('[PASS] Rejected payment preserves RESERVED inventory');

    const b = await fixture('B');
    const successArgs = {
      p_payment_id: b.payment,
      p_transaction_id: b.tx,
      p_connection_id: connection!.id,
      p_transaction_id_external: 'pay-life-B',
      p_verified_amount: 100,
      p_verified_currency: 'BRL',
      p_gateway_fee: 1,
      p_net_amount: 99,
      p_verified_outcome: 'SUCCESS' as const
    };

    const first = await client.rpc('settle_payment_lifecycle', successArgs);
    assert.ok(!first.error, first.error?.message ?? 'successful settlement failed');
    assert.strictEqual(first.data, true);

    const replay = await client.rpc('settle_payment_lifecycle', successArgs);
    assert.ok(!replay.error, replay.error?.message ?? 'successful replay failed');
    assert.strictEqual(replay.data, true);

    const invB = (await client.from('master_inventory')
      .select('reserved, committed')
      .eq('master_variant_id', variant!.id).single()).data;
    assert.deepStrictEqual(invB, { reserved: 2, committed: 2 });

    const resB = (await client.from('inventory_reservations')
      .select('status').eq('id', b.reservation).single()).data;
    assert.strictEqual(resB?.status, 'COMMITTED');

    const movesB = (await client.from('inventory_movements')
      .select('id')
      .eq('master_variant_id', variant!.id)
      .eq('movement_type', 'COMMIT')
      .eq('reference_id', b.order));
    assert.strictEqual(movesB.data?.length, 1);

    const orderB = (await client.from('orders').select('status').eq('id', b.order).single()).data;
    assert.strictEqual(orderB?.status, 'PAID');

    const paymentB = (await client.from('payments').select('status').eq('id', b.payment).single()).data;
    assert.strictEqual(paymentB?.status, 'PAID');

    const txB = (await client.from('payment_transactions').select('status').eq('id', b.tx).single()).data;
    assert.strictEqual(txB?.status, 'SUCCESS');
    console.log('[PASS] Successful settlement commits once and exact replay is idempotent');

    const c = await fixture('C');
    const cancel1 = await client.rpc('cancel_pending_payment_order', { p_order_id: c.order });
    assert.ok(!cancel1.error, cancel1.error?.message ?? 'first cancellation failed');
    const cancel2 = await client.rpc('cancel_pending_payment_order', { p_order_id: c.order });
    assert.ok(!cancel2.error, cancel2.error?.message ?? 'cancellation replay failed');

    const invC = (await client.from('master_inventory')
      .select('reserved, committed')
      .eq('master_variant_id', variant!.id).single()).data;
    assert.deepStrictEqual(invC, { reserved: 2, committed: 2 });

    const resC = (await client.from('inventory_reservations')
      .select('status, released_at').eq('id', c.reservation).single()).data;
    assert.strictEqual(resC?.status, 'RELEASED');
    assert.ok(resC?.released_at);

    const ordC = (await client.from('orders')
      .select('status').eq('id', c.order).single()).data;
    assert.strictEqual(ordC?.status, 'CANCELLED');

    const movesC = (await client.from('inventory_movements')
      .select('id')
      .eq('master_variant_id', variant!.id)
      .eq('movement_type', 'RELEASE')
      .eq('reference_id', c.order));
    assert.strictEqual(movesC.data?.length, 1);

    console.log('[PASS] Cancellation releases once and exact replay is idempotent');
    console.log('== ALL PAYMENT LIFECYCLE V1 REGRESSION TESTS PASSED ==');
  } finally {
    for (const id of txs) await client.from('payment_transactions').delete().eq('id', id);
    for (const id of payments) await client.from('payments').delete().eq('id', id);
    for (const id of orders) {
      await client.from('inventory_movements').delete().eq('reference_id', id);
      await client.from('orders').delete().eq('id', id);
    }
    for (const id of reservations) await client.from('inventory_reservations').delete().eq('id', id);
    for (const id of checkouts) await client.from('checkouts').delete().eq('id', id);
    for (const id of carts) await client.from('carts').delete().eq('id', id);
    await client.from('master_inventory').delete().eq('master_variant_id', variant!.id);
    await client.from('master_product_variants').delete().eq('id', variant!.id);
    await client.from('master_products').delete().eq('id', product!.id);
    await client.from('suppliers').delete().eq('id', supplier!.id);
    await client.from('gateway_connections').delete().eq('id', connection!.id);
    await client.from('stores').delete().eq('id', store!.id);
    await client.from('customers').delete().eq('id', customer!.id);
    await client.from('organizations').delete().eq('id', org!.id);
  }
}

run().catch((err) => {
  console.error('Payment lifecycle regression failure:', err);
  process.exit(1);
});
