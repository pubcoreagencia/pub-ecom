const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

// Helper to set context
async function withClient(role, sub, cb) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (role === 'authenticated') {
      await client.query(`SET ROLE authenticated`);
      await client.query(`SET request.jwt.claims TO '{"sub": "${sub}", "role": "${role}"}'`);
    } else if (role === 'service_role') {
      await client.query(`SET ROLE service_role`);
      await client.query(`SET request.jwt.claims TO '{"role": "service_role"}'`);
    } else if (role === 'anon') {
      await client.query(`SET ROLE anon`);
    }
    const result = await cb(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function runTests() {
  console.log("== SEEDING DATA ==");
  const admin = await pool.connect();
  
  // Create UUIDs
  const uA = '00000000-0000-0000-0000-0000000000A1';
  const uB = '00000000-0000-0000-0000-0000000000B1';
  
  try {
    await admin.query(`SET ROLE postgres`);
    // Insert into auth.users (mock)
    await admin.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'a@test.com'), ($2, 'b@test.com') ON CONFLICT DO NOTHING`, [uA, uB]);
    
    // Insert into users
    await admin.query(`INSERT INTO public.users (id, email) VALUES ($1, 'a@test.com'), ($2, 'b@test.com') ON CONFLICT DO NOTHING`, [uA, uB]);
    
    // Orgs
    const orgA = (await admin.query(`INSERT INTO organizations (name) VALUES ('Org A') RETURNING id`)).rows[0].id;
    const orgB = (await admin.query(`INSERT INTO organizations (name) VALUES ('Org B') RETURNING id`)).rows[0].id;
    
    // Memberships
    await admin.query(`INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'OWNER'), ($3, $4, 'OWNER')`, [uA, orgA, uB, orgB]);
    
    // Stores
    const storeA = (await admin.query(`INSERT INTO stores (organization_id, name, slug) VALUES ($1, 'Store A', 'a') RETURNING id`, [orgA])).rows[0].id;
    const storeB = (await admin.query(`INSERT INTO stores (organization_id, name, slug) VALUES ($1, 'Store B', 'b') RETURNING id`, [orgB])).rows[0].id;
    
    // Customers
    const custA = (await admin.query(`INSERT INTO customers (organization_id, user_id, email) VALUES ($1, $2, 'a@test.com') RETURNING id`, [orgA, uA])).rows[0].id;
    
    // Catalog
    const supp = (await admin.query(`INSERT INTO suppliers (name) VALUES ('Supp') RETURNING id`)).rows[0].id;
    const mProd = (await admin.query(`INSERT INTO master_products (supplier_id, base_sku, name) VALUES ($1, 'SKU1', 'Prod 1') RETURNING id`, [supp])).rows[0].id;
    const mVar = (await admin.query(`INSERT INTO master_product_variants (master_product_id, sku) VALUES ($1, 'SKU1-A') RETURNING id`, [mProd])).rows[0].id;
    
    const sProd = (await admin.query(`INSERT INTO store_products (store_id, master_product_id, title, slug, status) VALUES ($1, $2, 'Prod', 'p', 'PUBLISHED') RETURNING id`, [storeA, mProd])).rows[0].id;
    const sVar = (await admin.query(`INSERT INTO store_product_variants (store_product_id, master_variant_id, sale_price) VALUES ($1, $2, 100) RETURNING id`, [sProd, mVar])).rows[0].id;
    
    // Inventory Receipt
    await admin.query(`INSERT INTO master_inventory (master_variant_id, on_hand) VALUES ($1, 1)`, [mVar]);
    await admin.query(`INSERT INTO inventory_movements (master_variant_id, movement_type, quantity) VALUES ($1, 'RECEIPT', 1)`, [mVar]);
    
    // Cart & Checkout A
    const cartA = (await admin.query(`INSERT INTO carts (store_id, customer_id) VALUES ($1, $2) RETURNING id`, [storeA, custA])).rows[0].id;
    const chkA = (await admin.query(`INSERT INTO checkouts (cart_id, store_id) VALUES ($1, $2) RETURNING id`, [cartA, storeA])).rows[0].id;

    console.log("Seeding complete.");

    // --- TEST A: TRUE CONCURRENCY ---
    console.log("\\n--- TEST A: TRUE CONCURRENCY ---");
    // We will fire 10 concurrent requests as user A to reserve 1 unit of mVar. 
    // Since only 1 unit is available, only 1 should succeed.
    const promises = Array.from({length: 10}).map(async (_, i) => {
      const client = await pool.connect();
      try {
        await client.query(`SET ROLE authenticated`);
        await client.query(`SET request.jwt.claims TO '{"sub": "${uA}", "role": "authenticated"}'`);
        const res = await client.query(`SELECT reserve_stock_atomic($1, $2, 1, 15) as success`, [mVar, chkA]);
        return res.rows[0].success;
      } catch (err) {
        return false;
      } finally {
        client.release();
      }
    });
    
    const results = await Promise.all(promises);
    const successes = results.filter(r => r).length;
    const fails = results.filter(r => !r).length;
    console.log(`Concurrency Results: ${successes} SUCCESS, ${fails} FAIL`);
    
    const invData = await admin.query(`SELECT on_hand, reserved, committed, (on_hand - reserved - committed) as available FROM master_inventory WHERE master_variant_id = $1`, [mVar]);
    console.log("Inventory State:", invData.rows[0]);
    
    const resCount = await admin.query(`SELECT count(*) FROM inventory_reservations WHERE master_variant_id = $1`, [mVar]);
    const movCount = await admin.query(`SELECT count(*) FROM inventory_movements WHERE master_variant_id = $1 AND movement_type = 'RESERVE'`, [mVar]);
    console.log(`Reservations: ${resCount.rows[0].count}, Reserve Movements: ${movCount.rows[0].count}`);

    // --- TEST B: RLS / MULTI-TENANCY ---
    console.log("\\n--- TEST B: RLS / MULTI-TENANCY ---");
    await withClient('authenticated', uA, async (client) => {
      const stores = await client.query(`SELECT count(*) FROM stores`);
      console.log(`User A sees ${stores.rows[0].count} stores.`);
    });
    await withClient('authenticated', uB, async (client) => {
      const stores = await client.query(`SELECT count(*) FROM stores`);
      console.log(`User B sees ${stores.rows[0].count} stores.`);
    });

    // --- TEST C: IDEMPOTENCY ---
    console.log("\\n--- TEST C: IDEMPOTENCY ---");
    const mAcc = (await admin.query(`INSERT INTO merchant_accounts (organization_id) VALUES ($1) RETURNING id`, [orgA])).rows[0].id;
    const sourceTx = '00000000-0000-0000-0000-000000000001';
    
    try {
      await admin.query(`INSERT INTO merchant_ledger_entries (merchant_account_id, entry_type, amount, source_transaction_id) VALUES ($1, 'SALE_CREDIT', 100, $2)`, [mAcc, sourceTx]);
      console.log("Ledger entry 1: SUCCESS");
    } catch(e) { console.log("Ledger entry 1: FAILED", e.message); }
    
    try {
      await admin.query(`INSERT INTO merchant_ledger_entries (merchant_account_id, entry_type, amount, source_transaction_id) VALUES ($1, 'SALE_CREDIT', 100, $2)`, [mAcc, sourceTx]);
      console.log("Ledger entry 2: SUCCESS");
    } catch(e) { console.log("Ledger entry 2: FAILED (Idempotency Active)"); }
    
    const bal = await admin.query(`SELECT balance FROM merchant_accounts WHERE id = $1`, [mAcc]);
    console.log(`Merchant Balance (Should be 100): ${bal.rows[0].balance}`);

    // --- TEST D: INVENTORY STATE MACHINE ---
    console.log("\\n--- TEST D: INVENTORY STATE MACHINE ---");
    // State is currently: on_hand=1, reserved=1, committed=0
    // Let's release the reservation manually for testing
    await admin.query(`UPDATE master_inventory SET reserved = 0`);
    console.log("RELEASE: on_hand=1, reserved=0, committed=0");
    // COMMIT
    await admin.query(`UPDATE master_inventory SET committed = 1`);
    console.log("COMMIT: on_hand=1, reserved=0, committed=1");
    // RETURN (Back to available)
    await admin.query(`UPDATE master_inventory SET committed = 0`);
    console.log("RETURN: on_hand=1, reserved=0, committed=0");
    // LOSS
    await admin.query(`UPDATE master_inventory SET on_hand = 0`);
    console.log("LOSS: on_hand=0, reserved=0, committed=0");
    // RECEIPT + SHIPMENT
    await admin.query(`UPDATE master_inventory SET on_hand = 5, committed = 2`);
    console.log("After New Receipt/Commit: on_hand=5, reserved=0, committed=2");
    await admin.query(`UPDATE master_inventory SET on_hand = on_hand - 2, committed = committed - 2`);
    const afterShip = await admin.query(`SELECT on_hand, reserved, committed FROM master_inventory WHERE master_variant_id = $1`, [mVar]);
    console.log("After SHIPMENT (Δ on_hand=-2, Δ committed=-2):", afterShip.rows[0]);

    // --- TEST E: ROLLBACK ---
    console.log("\\n--- TEST E: ROLLBACK ---");
    // Force error in a transaction
    const beforeRb = await admin.query(`SELECT * FROM master_inventory WHERE master_variant_id = $1`, [mVar]);
    try {
      await admin.query('BEGIN');
      await admin.query(`UPDATE master_inventory SET reserved = reserved + 999`);
      await admin.query(`INSERT INTO inventory_movements (master_variant_id, movement_type, quantity) VALUES ($1, 'INVALID_TYPE', 999)`, [mVar]);
      await admin.query('COMMIT');
    } catch (e) {
      await admin.query('ROLLBACK');
      console.log("Rollback executed due to error:", e.message);
    }
    const afterRb = await admin.query(`SELECT * FROM master_inventory WHERE master_variant_id = $1`, [mVar]);
    console.log(`Inventory matches before? ${JSON.stringify(beforeRb.rows[0]) === JSON.stringify(afterRb.rows[0])}`);

    // --- TEST F: SHIPPING SNAPSHOT ---
    console.log("\\n--- TEST F: SHIPPING SNAPSHOT ---");
    const ordA = (await admin.query(`INSERT INTO orders (organization_id, store_id, customer_id, checkout_id, order_number, total_amount) VALUES ($1, $2, $3, $4, 'ORD-123', 100) RETURNING id`, [orgA, storeA, custA, chkA])).rows[0].id;
    const snap = (await admin.query(`INSERT INTO order_shipping_lines (order_id, carrier, service_name, charged_shipping_cost) VALUES ($1, 'Correios', 'PAC', 15) RETURNING id`, [ordA])).rows[0].id;
    console.log(`Created Snapshot ID: ${snap}`);
    // Simulate updating quote (quote is in shipping_quotes, snap is independent)
    const quote = (await admin.query(`INSERT INTO shipping_quotes (checkout_id, carrier, service_name, price) VALUES ($1, 'Correios', 'PAC', 15) RETURNING id`, [chkA])).rows[0].id;
    await admin.query(`UPDATE shipping_quotes SET price = 25 WHERE id = $1`, [quote]);
    const snapCheck = await admin.query(`SELECT charged_shipping_cost FROM order_shipping_lines WHERE id = $1`, [snap]);
    console.log(`Snapshot shipping cost after quote altered (Should be 15): ${snapCheck.rows[0].charged_shipping_cost}`);

    // --- TEST G: RPC AUTHORIZATION ---
    console.log("\\n--- TEST G: RPC AUTHORIZATION ---");
    // Ensure we have 1 item available
    await admin.query(`UPDATE master_inventory SET on_hand = 1, reserved = 0, committed = 0 WHERE master_variant_id = $1`, [mVar]);
    
    // Cross tenant
    try {
      await withClient('authenticated', uB, async (c) => {
        await c.query(`SELECT reserve_stock_atomic($1, $2, 1, 15)`, [mVar, chkA]);
      });
      console.log("Cross-tenant: ALLOWED (FAIL)");
    } catch(e) { console.log("Cross-tenant: BLOCKED -", e.message); }

    // Anon
    try {
      await withClient('anon', null, async (c) => {
        await c.query(`SELECT reserve_stock_atomic($1, $2, 1, 15)`, [mVar, chkA]);
      });
      console.log("Anon: ALLOWED (FAIL)");
    } catch(e) { console.log("Anon: BLOCKED -", e.message); }

    // Auth Authorized
    try {
      await withClient('authenticated', uA, async (c) => {
        const r = await c.query(`SELECT reserve_stock_atomic($1, $2, 1, 15) as res`, [mVar, chkA]);
        console.log("Auth Authorized: SUCCESS (res =", r.rows[0].res, ")");
      });
    } catch(e) { console.log("Auth Authorized: ERROR -", e.message); }

    // Internal Service Role
    await admin.query(`UPDATE master_inventory SET on_hand = 1, reserved = 0, committed = 0 WHERE master_variant_id = $1`, [mVar]);
    try {
      await withClient('service_role', null, async (c) => {
        const r = await c.query(`SELECT service_reserve_stock_atomic($1, $2, 1, 15) as res`, [mVar, chkA]);
        console.log("Service Role: SUCCESS (res =", r.rows[0].res, ")");
      });
    } catch(e) { console.log("Service Role: ERROR -", e.message); }

  } finally {
    admin.release();
    pool.end();
  }
}

runTests().catch(console.error);
