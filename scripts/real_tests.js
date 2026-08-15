const { createClient } = require('@supabase/supabase-js');
global.WebSocket = require('ws');
const { Pool } = require('pg');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function run() {
  console.log("== SEEDING REAL AUTH ==");
  
  // 1. Create Real Auth Users
  const { data: authA, error: errA } = await serviceClient.auth.admin.createUser({
    email: 'usera_' + Date.now() + '@test.com',
    password: 'password123',
    email_confirm: true
  });
  if (errA) throw errA;
  const userA = authA.user;

  const { data: authB, error: errB } = await serviceClient.auth.admin.createUser({
    email: 'userb_' + Date.now() + '@test.com',
    password: 'password123',
    email_confirm: true
  });
  if (errB) throw errB;
  const userB = authB.user;

  // Insert into public.users mirror since there might not be a trigger
  const pgAdmin = await pool.connect();
  await pgAdmin.query(`INSERT INTO public.users (id, email) VALUES ($1, $2), ($3, $4) ON CONFLICT DO NOTHING`, [userA.id, userA.email, userB.id, userB.email]);
  
  // Sign in to get REAL JWTs
  const clientA = createClient(SUPABASE_URL, ANON_KEY);
  await clientA.auth.signInWithPassword({ email: userA.email, password: 'password123' });
  const sessionA = (await clientA.auth.getSession()).data.session;
  
  const clientB = createClient(SUPABASE_URL, ANON_KEY);
  await clientB.auth.signInWithPassword({ email: userB.email, password: 'password123' });
  const sessionB = (await clientB.auth.getSession()).data.session;

  console.log("Got real JWTs from GoTrue.");

  // Seeding Tenant A and Tenant B data
  const orgA = (await pgAdmin.query(`INSERT INTO organizations (name) VALUES ('Real Org A') RETURNING id`)).rows[0].id;
  const orgB = (await pgAdmin.query(`INSERT INTO organizations (name) VALUES ('Real Org B') RETURNING id`)).rows[0].id;
  
  await pgAdmin.query(`INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'OPERATOR')`, [userA.id, orgA]);
  await pgAdmin.query(`INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'OWNER')`, [userB.id, orgB]);
  
  const storeA = (await pgAdmin.query(`INSERT INTO stores (organization_id, name, slug) VALUES ($1, 'Real Store A', 'real-a') RETURNING id`, [orgA])).rows[0].id;
  const storeB = (await pgAdmin.query(`INSERT INTO stores (organization_id, name, slug) VALUES ($1, 'Real Store B', 'real-b') RETURNING id`, [orgB])).rows[0].id;
  
  const custA = (await pgAdmin.query(`INSERT INTO customers (organization_id, user_id, email) VALUES ($1, $2, $3) RETURNING id`, [orgA, userA.id, userA.email])).rows[0].id;
  const custB = (await pgAdmin.query(`INSERT INTO customers (organization_id, user_id, email) VALUES ($1, $2, $3) RETURNING id`, [orgB, userB.id, userB.email])).rows[0].id;
  
  const cartA = (await pgAdmin.query(`INSERT INTO carts (store_id, customer_id) VALUES ($1, $2) RETURNING id`, [storeA, custA])).rows[0].id;
  const chkA = (await pgAdmin.query(`INSERT INTO checkouts (cart_id, store_id) VALUES ($1, $2) RETURNING id`, [cartA, storeA])).rows[0].id;

  const ordB = (await pgAdmin.query(`INSERT INTO orders (organization_id, store_id, customer_id, order_number, total_amount) VALUES ($1, $2, $3, 'ORD-B', 50) RETURNING id`, [orgB, storeB, custB])).rows[0].id;

  const mAccA = (await pgAdmin.query(`INSERT INTO merchant_accounts (organization_id) VALUES ($1) RETURNING id`, [orgA])).rows[0].id;

  // Catalog
  const supp = (await pgAdmin.query(`INSERT INTO suppliers (name) VALUES ('Supp') RETURNING id`)).rows[0].id;
  const mProd = (await pgAdmin.query(`INSERT INTO master_products (supplier_id, base_sku, name) VALUES ($1, 'SKU-TEST', 'Prod Test') RETURNING id`, [supp])).rows[0].id;
  const mVar = (await pgAdmin.query(`INSERT INTO master_product_variants (master_product_id, sku) VALUES ($1, 'SKU-TEST-A') RETURNING id`, [mProd])).rows[0].id;
  const sProd = (await pgAdmin.query(`INSERT INTO store_products (store_id, master_product_id, title, slug, status) VALUES ($1, $2, 'Prod', 'ptest', 'PUBLISHED') RETURNING id`, [storeA, mProd])).rows[0].id;
  const sVar = (await pgAdmin.query(`INSERT INTO store_product_variants (store_product_id, master_variant_id, sale_price) VALUES ($1, $2, 100) RETURNING id`, [sProd, mVar])).rows[0].id;
  
  await pgAdmin.query(`INSERT INTO master_inventory (master_variant_id, on_hand) VALUES ($1, 100)`, [mVar]);


  // --- TEST B: REAL JWT RLS ---
  console.log("\\n--- TEST B: REAL JWT RLS ---");
  // 1. User A sees its tenant
  const resStoreA = await clientA.from('stores').select('*');
  console.log(`1. User A sees ${resStoreA.data.length} stores. Expected: 1.`);
  
  // 2. User A NOT sees tenant B
  const resStoreA_B = await clientA.from('stores').select('*').eq('id', storeB);
  console.log(`2. User A sees tenant B: ${resStoreA_B.data.length > 0}. Expected: false.`);

  // 3 & 4. User B
  const resStoreB = await clientB.from('stores').select('*');
  console.log(`3. User B sees ${resStoreB.data.length} stores. Expected: 1.`);
  const resStoreB_A = await clientB.from('stores').select('*').eq('id', storeA);
  console.log(`4. User B sees tenant A: ${resStoreB_A.data.length > 0}. Expected: false.`);

  // 5 & 6. Mutation isolation
  const mutA = await clientA.from('stores').update({name: 'Hacked'}).eq('id', storeB);
  console.log(`5. User A alters B: count=${mutA.data?.length || 0}, err=${mutA.error?.message || 'none'}. Expected: 0/none (silently ignored by RLS)`);
  
  const mutB = await clientB.from('stores').update({name: 'Hacked'}).eq('id', storeA);
  console.log(`6. User B alters A: count=${mutB.data?.length || 0}. Expected: 0`);

  // 7. Customer A sees Order B?
  const ordSee = await clientA.from('orders').select('*').eq('id', ordB);
  console.log(`7. Customer A sees Order B: count=${ordSee.data.length}. Expected: 0`);

  // 8. Operator A sees ledger?
  // A is OPERATOR. Should not see merchant_accounts.
  const ledA = await clientA.from('merchant_accounts').select('*');
  console.log(`8. Operator A sees ledger: count=${ledA.data.length}. Expected: 0`);

  // 9. Anon blocked
  const anonRes = await anonClient.from('customers').select('*');
  console.log(`9. Anon sees customers: count=${anonRes.error ? anonRes.error.message : anonRes.data.length}. Expected: 0 or error`);


  // --- TEST D: INVENTORY FULL SEQUENCE ---
  console.log("\\n--- TEST D: INVENTORY FULL SEQUENCE ---");
  // Create another product for clean test
  const mVar2 = (await pgAdmin.query(`INSERT INTO master_product_variants (master_product_id, sku) VALUES ($1, 'SKU-D') RETURNING id`, [mProd])).rows[0].id;
  await pgAdmin.query(`INSERT INTO master_inventory (master_variant_id, on_hand) VALUES ($1, 0)`, [mVar2]);

  async function invState() {
    const r = await pgAdmin.query(`SELECT on_hand, reserved, committed, (on_hand - reserved - committed) as available FROM master_inventory WHERE master_variant_id = $1`, [mVar2]);
    return r.rows[0];
  }

  // RECEIPT = 100
  await pgAdmin.query(`UPDATE master_inventory SET on_hand = on_hand + 100 WHERE master_variant_id = $1`, [mVar2]);
  console.log("After RECEIPT (100):", await invState());
  
  // RESERVE = 10
  await pgAdmin.query(`UPDATE master_inventory SET reserved = reserved + 10 WHERE master_variant_id = $1`, [mVar2]);
  console.log("After RESERVE (10):", await invState());

  // RELEASE = 2
  await pgAdmin.query(`UPDATE master_inventory SET reserved = reserved - 2 WHERE master_variant_id = $1`, [mVar2]);
  console.log("After RELEASE (2):", await invState());

  // COMMIT = 8
  await pgAdmin.query(`UPDATE master_inventory SET reserved = reserved - 8, committed = committed + 8 WHERE master_variant_id = $1`, [mVar2]);
  console.log("After COMMIT (8):", await invState());

  // RETURN = 1
  await pgAdmin.query(`UPDATE master_inventory SET committed = committed - 1 WHERE master_variant_id = $1`, [mVar2]);
  console.log("After RETURN (1):", await invState());

  // LOSS = 3
  await pgAdmin.query(`UPDATE master_inventory SET on_hand = on_hand - 3 WHERE master_variant_id = $1`, [mVar2]);
  console.log("After LOSS (3):", await invState());

  // FLOW: COMMIT = 2 -> SHIPMENT = 2
  await pgAdmin.query(`UPDATE master_inventory SET committed = committed + 2 WHERE master_variant_id = $1`, [mVar2]);
  console.log("Before SHIPMENT (COMMIT + 2):", await invState());
  await pgAdmin.query(`UPDATE master_inventory SET on_hand = on_hand - 2, committed = committed - 2 WHERE master_variant_id = $1`, [mVar2]);
  console.log("After SHIPMENT (2):", await invState());


  // --- TEST G: RPC AUTHORIZATION (REAL JWT) ---
  console.log("\\n--- TEST G: RPC AUTHORIZATION ---");
  // Auth Authorized (User A on chkA)
  const rpcAuth = await clientA.rpc('reserve_stock_atomic', { p_master_variant_id: mVar, p_checkout_id: chkA, p_quantity: 1, p_ttl_minutes: 15 });
  console.log(`Auth Authorized: success=${rpcAuth.data}, err=${rpcAuth.error?.message || 'none'}`);

  // Auth Não Autorizado (User B on chkA)
  const rpcUnauth = await clientB.rpc('reserve_stock_atomic', { p_master_variant_id: mVar, p_checkout_id: chkA, p_quantity: 1, p_ttl_minutes: 15 });
  console.log(`Auth Não Autorizado / Cross-tenant: success=${rpcUnauth.data}, err=${rpcUnauth.error?.message}`);

  // Anon
  const rpcAnon = await anonClient.rpc('reserve_stock_atomic', { p_master_variant_id: mVar, p_checkout_id: chkA, p_quantity: 1, p_ttl_minutes: 15 });
  console.log(`Anon: success=${rpcAnon.data}, err=${rpcAnon.error?.message}`);

  // Service Role
  const rpcService = await serviceClient.rpc('service_reserve_stock_atomic', { p_master_variant_id: mVar, p_checkout_id: chkA, p_quantity: 1, p_ttl_minutes: 15 });
  console.log(`Service Role: success=${rpcService.data}, err=${rpcService.error?.message || 'none'}`);

  pgAdmin.release();
  pool.end();
}

run().catch(console.error);
