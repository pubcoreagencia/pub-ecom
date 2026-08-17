const assert = require("node:assert");

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function withClient(role: string, sub: string | null, cb: (c: any) => Promise<any>) {
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
  console.log("== RUNNING MEDIA TESTS ==");
  const admin = await pool.connect();
  
  // Create UUIDs
  const uA = '00000000-0000-0000-0000-0000000000A1';
  const uB = '00000000-0000-0000-0000-0000000000B1';
  
  try {
    await admin.query(`INSERT INTO users (id, email, full_name) VALUES ($1, 'a@test.com', 'A') ON CONFLICT DO NOTHING`, [uA]);
    await admin.query(`INSERT INTO users (id, email, full_name) VALUES ($1, 'b@test.com', 'B') ON CONFLICT DO NOTHING`, [uB]);
    
    const orgA = (await admin.query(`INSERT INTO organizations (name, document) VALUES ('Org A', '111') RETURNING id`)).rows[0].id;
    const orgB = (await admin.query(`INSERT INTO organizations (name, document) VALUES ('Org B', '222') RETURNING id`)).rows[0].id;

    await admin.query(`INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'OWNER')`, [uA, orgA]);
    await admin.query(`INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'OWNER')`, [uB, orgB]);

    const storeA = (await admin.query(`INSERT INTO stores (organization_id, name, slug) VALUES ($1, 'Store A', 'st-a') RETURNING id`, [orgA])).rows[0].id;
    const storeB = (await admin.query(`INSERT INTO stores (organization_id, name, slug) VALUES ($1, 'Store B', 'st-b') RETURNING id`, [orgB])).rows[0].id;

    const supplier = (await admin.query(`INSERT INTO suppliers (name) VALUES ('Sup') RETURNING id`)).rows[0].id;
    const mProd = (await admin.query(`INSERT INTO master_products (base_sku, supplier_id, name) VALUES ('SKU-1', $1, 'Prod 1') RETURNING id`, [supplier])).rows[0].id;

    // Test 1: Insert Media Asset & Generated representation
    let assetId1 = '';
    await withClient('authenticated', uA, async (c) => {
      const res = await c.query(`INSERT INTO media_assets (asset_type, source_type, storage_path) VALUES ('IMAGE', 'UPLOAD', '/img/1.png') RETURNING id`);
      assetId1 = res.rows[0].id;
    });

    // Test External representation
    let assetId2 = '';
    await withClient('authenticated', uA, async (c) => {
      const res = await c.query(`INSERT INTO media_assets (asset_type, source_type, external_url) VALUES ('IMAGE', 'EXTERNAL', 'https://ext.com/img.png') RETURNING id`);
      assetId2 = res.rows[0].id;
    });

    // Test 2: master product -> media relationship (requires service_role since policy denies others)
    try {
        await withClient('authenticated', uA, async (c) => {
            await c.query(`INSERT INTO master_product_media (master_product_id, media_asset_id, position, is_primary) VALUES ($1, $2, 1, true)`, [mProd, assetId1]);
        });
        assert.fail('Should have failed to insert master media as authenticated');
    } catch (e: any) {
        assert(e.message.includes('policy')); // RLS blocks
    }

    // Now as service role
    await withClient('service_role', null, async (c) => {
        await c.query(`INSERT INTO master_product_media (master_product_id, media_asset_id, position, is_primary) VALUES ($1, $2, 1, true)`, [mProd, assetId1]);
    });

    // Test 3: primary media behavior & ordering
    try {
        await withClient('service_role', null, async (c) => {
            await c.query(`INSERT INTO master_product_media (master_product_id, media_asset_id, position, is_primary) VALUES ($1, $2, 2, true)`, [mProd, assetId2]);
        });
        assert.fail('Should block duplicate primary media');
    } catch (e: any) {
        assert(e.message.includes('unique constraint') || e.message.includes('duplicate key'));
    }

    // Test 4: store -> media relationship + invalid cross-store relationship
    await withClient('authenticated', uA, async (c) => {
        await c.query(`INSERT INTO store_media (store_id, media_asset_id, purpose) VALUES ($1, $2, 'LOGO')`, [storeA, assetId1]);
    });

    try {
        await withClient('authenticated', uA, async (c) => {
            // User A trying to add logo to Store B
            await c.query(`INSERT INTO store_media (store_id, media_asset_id, purpose) VALUES ($1, $2, 'FAVICON')`, [storeB, assetId2]);
        });
        assert.fail('Should block cross-store insert');
    } catch (e: any) {
        assert(e.message.includes('policy')); // RLS blocks
    }

    // Test 5: Unique Logo constraint
    try {
        await withClient('authenticated', uA, async (c) => {
            await c.query(`INSERT INTO store_media (store_id, media_asset_id, purpose) VALUES ($1, $2, 'LOGO')`, [storeA, assetId2]);
        });
        assert.fail('Should block multiple LOGOs per store');
    } catch(e: any) {
        assert(e.message.includes('unique constraint') || e.message.includes('duplicate key'));
    }

    console.log("All Media Tests PASSED.");

  } finally {
    admin.release();
    pool.end();
  }
}

runTests().catch(e => {
  console.error("Media Tests Failed:", e.message);
  process.exit(1);
});
