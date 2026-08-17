const assert = require('node:assert');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

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
  console.log("== RUNNING CART ITEMS SECURITY TESTS ==");
  const admin = await pool.connect();
  
  const uA = '00000000-0000-0000-0000-0000000000C1';
  const uB = '00000000-0000-0000-0000-0000000000C2';
  const custA = '11111111-0000-0000-0000-0000000000C1';
  const custB = '11111111-0000-0000-0000-0000000000C2';
  
  try {
    await admin.query(`SET ROLE postgres`);
    await admin.query(`TRUNCATE TABLE carts, customers, store_products, master_products, stores, memberships, organizations, users, auth.users CASCADE`);
    await admin.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'a3@test.com'), ($2, 'b3@test.com') ON CONFLICT DO NOTHING`, [uA, uB]);
    await admin.query(`INSERT INTO users (id, email, full_name) VALUES ($1, 'a3@test.com', 'A3') ON CONFLICT DO NOTHING`, [uA]);
    await admin.query(`INSERT INTO users (id, email, full_name) VALUES ($1, 'b3@test.com', 'B3') ON CONFLICT DO NOTHING`, [uB]);
    
    const docA = Math.random().toString().slice(2, 10);
    const docB = Math.random().toString().slice(2, 10);
    const orgA = (await admin.query(`INSERT INTO organizations (name, document) VALUES ('Org A3', $1) RETURNING id`, [docA])).rows[0].id;
    const orgB = (await admin.query(`INSERT INTO organizations (name, document) VALUES ('Org B3', $1) RETURNING id`, [docB])).rows[0].id;

    await admin.query(`INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'OWNER')`, [uA, orgA]);
    await admin.query(`INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'OWNER')`, [uB, orgB]);

    const storeA = (await admin.query(`INSERT INTO stores (organization_id, name, slug, status) VALUES ($1, 'Store A3', 'st-a3', 'ACTIVE') RETURNING id`, [orgA])).rows[0].id;
    const storeB = (await admin.query(`INSERT INTO stores (organization_id, name, slug, status) VALUES ($1, 'Store B3', 'st-b3', 'ACTIVE') RETURNING id`, [orgB])).rows[0].id;

    // Create Customers
    await admin.query(`INSERT INTO customers (id, organization_id, user_id, email) VALUES ($1, $2, $3, 'a3@test.com')`, [custA, orgA, uA]);
    await admin.query(`INSERT INTO customers (id, organization_id, user_id, email) VALUES ($1, $2, $3, 'b3@test.com')`, [custB, orgB, uB]);

    // Create Master Catalog & Store Products
    const supp = (await admin.query(`INSERT INTO suppliers (name) VALUES ('Supp') RETURNING id`)).rows[0].id;
    const mastP1 = (await admin.query(`INSERT INTO master_products (supplier_id, base_sku, name) VALUES ($1, 'SKU1', 'P1') RETURNING id`, [supp])).rows[0].id;
    const mastV1 = (await admin.query(`INSERT INTO master_product_variants (master_product_id, sku) VALUES ($1, 'SKU1-V') RETURNING id`, [mastP1])).rows[0].id;
    const mastP2 = (await admin.query(`INSERT INTO master_products (supplier_id, base_sku, name) VALUES ($1, 'SKU2', 'P2') RETURNING id`, [supp])).rows[0].id;
    const mastV2 = (await admin.query(`INSERT INTO master_product_variants (master_product_id, sku) VALUES ($1, 'SKU2-V') RETURNING id`, [mastP2])).rows[0].id;

    const spA = (await admin.query(`INSERT INTO store_products (store_id, master_product_id, title, slug, status) VALUES ($1, $2, 'P1A', 'p1a', 'PUBLISHED') RETURNING id`, [storeA, mastP1])).rows[0].id;
    const spvA = (await admin.query(`INSERT INTO store_product_variants (store_product_id, master_variant_id, sale_price) VALUES ($1, $2, 10.00) RETURNING id`, [spA, mastV1])).rows[0].id;
    
    const spB = (await admin.query(`INSERT INTO store_products (store_id, master_product_id, title, slug, status) VALUES ($1, $2, 'P2B', 'p2b', 'PUBLISHED') RETURNING id`, [storeB, mastP2])).rows[0].id;
    const spvB = (await admin.query(`INSERT INTO store_product_variants (store_product_id, master_variant_id, sale_price) VALUES ($1, $2, 20.00) RETURNING id`, [spB, mastV2])).rows[0].id;

    // Create Carts
    const cartA = (await admin.query(`INSERT INTO carts (store_id, customer_id) VALUES ($1, $2) RETURNING id`, [storeA, custA])).rows[0].id;
    const cartB = (await admin.query(`INSERT INTO carts (store_id, customer_id) VALUES ($1, $2) RETURNING id`, [storeB, custB])).rows[0].id;


    // 1. cart_items table exists
    const tblRes = await admin.query(`SELECT to_regclass('cart_items') as tbl`);
    assert(tblRes.rows[0].tbl === 'cart_items', 'cart_items table should exist');

    // 2. valid item can be inserted
    let itemAId = '';
    await withClient('service_role', null, async (c) => {
        const res = await c.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, 1) RETURNING id`, [cartA, spvA]);
        itemAId = res.rows[0].id;
        assert(itemAId, 'Should insert valid cart item');
    });

    // 3, 4, 5. quantity constraints
    try {
        await admin.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, 0)`, [cartA, spvA]);
        assert.fail('Should reject quantity 0');
    } catch(e) { assert(e.message.includes('cart_items_quantity_check')); }
    try {
        await admin.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, -1)`, [cartA, spvA]);
        assert.fail('Should reject quantity -1');
    } catch(e) { assert(e.message.includes('cart_items_quantity_check')); }

    // 6. duplicate cart + variant rejected
    try {
        await admin.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, 1)`, [cartA, spvA]);
        assert.fail('Should reject duplicate variant in cart');
    } catch(e) { assert(e.message.includes('cart_items_cart_id_store_product_variant_id_key')); }

    // 7. cart FK enforced
    try {
        const fakeUUID = '99999999-9999-9999-9999-999999999999';
        await admin.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, 1)`, [fakeUUID, spvA]);
        assert.fail('Should enforce cart FK');
    } catch(e) { assert(e.message.includes('cart_items_cart_id_fkey')); }

    // 8. variant FK enforced
    try {
        const fakeUUID = '99999999-9999-9999-9999-999999999999';
        await admin.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, 1)`, [cartA, fakeUUID]);
        assert.fail('Should enforce variant FK');
    } catch(e) { assert(e.message.includes('cart_items_store_product_variant_id_fkey')); }

    // 11. cart store != variant store rejected
    try {
        // Attempting to add spvB (from Store B) to cartA (Store A)
        await admin.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, 1)`, [cartA, spvB]);
        assert.fail('Should structurally block cross-store item insertion');
    } catch(e) { assert(e.message.includes('Cross-store cart item forbidden')); }

    // 12. update cannot create cart/variant store mismatch
    try {
        await admin.query(`UPDATE cart_items SET store_product_variant_id = $1 WHERE id = $2`, [spvB, itemAId]);
        assert.fail('Should block cross-store via update');
    } catch(e) { assert(e.message.includes('Cross-store cart item forbidden')); }

    // 13. authenticated customer can access own cart items
    await withClient('authenticated', uA, async (c) => {
        const res = await c.query(`SELECT * FROM cart_items`);
        assert.strictEqual(res.rows.length, 1, 'Customer A should see their cart item');
    });

    // 14. authenticated customer cannot access another customer's cart items
    await withClient('authenticated', uB, async (c) => {
        const res = await c.query(`SELECT * FROM cart_items`);
        assert.strictEqual(res.rows.length, 0, 'Customer B should not see Customer A cart item');
        
        // Try to insert into Customer A's cart as Customer B
        try {
             // SpvA is in Store A. uB doesn't own cart A.
            await c.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, 1)`, [cartA, spvA]);
            assert.fail('Customer B should not mutate Customer A cart');
        } catch(e) { assert(e.message.includes('policy')); }
    });

    // 15, 16. tenant operator can read allowed store cart items, cannot mutate
    await withClient('authenticated', uA, async (c) => {
        // As a tenant operator (uA is OWNER of orgA, which owns storeA)
        // He can see it. But since he is ALSO the customer, this tests both.
        // Let's create an operator user who is NOT a customer.
    });
    const uAO = '00000000-0000-0000-0000-0000000000D1';
    await admin.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'ao@test.com') ON CONFLICT DO NOTHING`, [uAO]);
    await admin.query(`INSERT INTO users (id, email, full_name) VALUES ($1, 'ao@test.com', 'AO') ON CONFLICT DO NOTHING`, [uAO]);
    await admin.query(`INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'OPERATOR')`, [uAO, orgA]);
    
    await withClient('authenticated', uAO, async (c) => {
        const res = await c.query(`SELECT * FROM cart_items`);
        assert.strictEqual(res.rows.length, 1, 'Operator should see store cart items');
        
        // Try mutate
        let updated = false;
        try {
            const upRes = await c.query(`UPDATE cart_items SET quantity = 2 RETURNING id`);
            updated = upRes.rows.length > 0;
        } catch(e) { }
        assert(!updated, 'Operator should NOT be able to update customer cart items via Tenant policy');
    });

    // 17-20. anon cannot SELECT, INSERT, UPDATE, DELETE
    try {
        await withClient('anon', null, async (c) => { await c.query(`SELECT * FROM cart_items`); });
        assert.fail('Should block anon select');
    } catch(e) { assert(e.message.includes('permission denied')); }
    try {
        await withClient('anon', null, async (c) => { await c.query(`INSERT INTO cart_items(cart_id, store_product_variant_id, quantity) VALUES ($1,$2,1)`, [cartA, spvA]); });
        assert.fail('Should block anon insert');
    } catch(e) { assert(e.message.includes('permission denied')); }
    try {
        await withClient('anon', null, async (c) => { await c.query(`UPDATE cart_items SET quantity = 2`); });
        assert.fail('Should block anon update');
    } catch(e) { assert(e.message.includes('permission denied')); }
    try {
        await withClient('anon', null, async (c) => { await c.query(`DELETE FROM cart_items`); });
        assert.fail('Should block anon delete');
    } catch(e) { assert(e.message.includes('permission denied')); }

    // 21. service_role remains functional
    await withClient('service_role', null, async (c) => {
        const res = await c.query(`UPDATE cart_items SET quantity = 5 WHERE id = $1 RETURNING id`, [itemAId]);
        assert.strictEqual(res.rows.length, 1, 'Service role must be able to mutate');
    });

    // 10. hard-deleted variant cascades
    await admin.query(`DELETE FROM store_product_variants WHERE id = $1`, [spvA]);
    const ciCount1 = (await admin.query(`SELECT count(*) FROM cart_items WHERE id = $1`, [itemAId])).rows[0].count;
    assert.strictEqual(parseInt(ciCount1), 0, 'Variant delete should cascade to cart_items');

    // 9. cart deletion cascades
    const spvB2 = (await admin.query(`INSERT INTO store_product_variants (store_product_id, master_variant_id, sale_price) VALUES ($1, $2, 20.00) RETURNING id`, [spB, mastV2])).rows[0].id;
    const itemBId = (await admin.query(`INSERT INTO cart_items (cart_id, store_product_variant_id, quantity) VALUES ($1, $2, 1) RETURNING id`, [cartB, spvB2])).rows[0].id;
    await admin.query(`DELETE FROM carts WHERE id = $1`, [cartB]);
    const ciCount2 = (await admin.query(`SELECT count(*) FROM cart_items WHERE id = $1`, [itemBId])).rows[0].count;
    assert.strictEqual(parseInt(ciCount2), 0, 'Cart delete should cascade to cart_items');

    console.log("All Cart Items Security Tests PASSED.");
    process.exit(0);

  } catch(e) {
    console.error("Failed:", e.message, e.stack);
    process.exit(1);
  } finally {
    admin.release();
    pool.end();
  }
}

runTests();
