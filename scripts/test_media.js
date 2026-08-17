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
  console.log("== RUNNING MEDIA SECURITY TESTS ==");
  const admin = await pool.connect();
  
  const uA = '00000000-0000-0000-0000-0000000000A1';
  const uB = '00000000-0000-0000-0000-0000000000B1';
  
  try {
    await admin.query(`SET ROLE postgres`);
    await admin.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'a@test.com'), ($2, 'b@test.com') ON CONFLICT DO NOTHING`, [uA, uB]);
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

    // Insert Store Product (DRAFT)
    const sprod = (await admin.query(`INSERT INTO store_products (store_id, master_product_id, title, slug, status) VALUES ($1, $2, 'SP 1', 'sp-1', 'DRAFT') RETURNING id`, [storeA, mProd])).rows[0].id;

    // 11. tenant cannot create a central asset with organization_id NULL
    try {
        await withClient('authenticated', uA, async (c) => {
            await c.query(`INSERT INTO media_assets (asset_type, source_type, storage_path) VALUES ('IMAGE', 'UPLOAD', '/img/null.png')`);
        });
        assert.fail('Should block tenant from inserting NULL org');
    } catch(e) { assert(e.message.includes('policy')); }

    // Tenant inserts their own asset
    let assetA = '';
    await withClient('authenticated', uA, async (c) => {
      const res = await c.query(`INSERT INTO media_assets (asset_type, source_type, storage_path, organization_id) VALUES ('IMAGE', 'UPLOAD', '/img/a.png', $1) RETURNING id`, [orgA]);
      assetA = res.rows[0].id;
    });

    // 1. anon cannot read orphan media_assets
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [assetA]);
        assert.strictEqual(res.rows.length, 0, 'Anon should not see orphan media');
    });

    // 13. central/service-role path remains functional
    let centralAsset = '';
    await withClient('service_role', null, async (c) => {
        const res = await c.query(`INSERT INTO media_assets (asset_type, source_type, storage_path) VALUES ('IMAGE', 'UPLOAD', '/img/central.png') RETURNING id`);
        centralAsset = res.rows[0].id;
        // link to master product
        await c.query(`INSERT INTO master_product_media (master_product_id, media_asset_id, position, is_primary) VALUES ($1, $2, 1, true)`, [mProd, centralAsset]);
    });

    // 2. anon cannot read media attached only to unpublished store_product (sprod is DRAFT)
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [centralAsset]);
        assert.strictEqual(res.rows.length, 0, 'Anon should not see master media when store product is DRAFT');
    });

    // Publish store product
    await admin.query(`UPDATE store_products SET status = 'PUBLISHED' WHERE id = $1`, [sprod]);

    // 6. anon CAN read media attached to a PUBLISHED store_product
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [centralAsset]);
        assert.strictEqual(res.rows.length, 1, 'Anon SHOULD see master media when store product is PUBLISHED');
    });

    // 8. changing published store_product to DRAFT removes anonymous visibility
    await admin.query(`UPDATE store_products SET status = 'DRAFT' WHERE id = $1`, [sprod]);
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [centralAsset]);
        assert.strictEqual(res.rows.length, 0, 'Anon visibility should be revoked when DRAFT');
    });
    // Archive
    await admin.query(`UPDATE store_products SET status = 'ARCHIVED' WHERE id = $1`, [sprod]);
    // 3. anon cannot read media attached only to archived store_product
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [centralAsset]);
        assert.strictEqual(res.rows.length, 0, 'Anon visibility should be revoked when ARCHIVED');
    });

    // Link assetA to storeA (ACTIVE)
    await withClient('authenticated', uA, async (c) => {
        await c.query(`INSERT INTO store_media (store_id, media_asset_id, purpose) VALUES ($1, $2, 'LOGO')`, [storeA, assetA]);
    });

    // 7. anon CAN read store_media attached to ACTIVE store
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [assetA]);
        assert.strictEqual(res.rows.length, 1, 'Anon SHOULD see active store media');
    });

    // 9. changing store from ACTIVE to INACTIVE removes anonymous store-media visibility
    await admin.query(`UPDATE stores SET status = 'INACTIVE' WHERE id = $1`, [storeA]);
    // 4. anon cannot read media belonging only to inactive store
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [assetA]);
        assert.strictEqual(res.rows.length, 0, 'Anon visibility should be revoked when INACTIVE');
    });

    await admin.query(`UPDATE stores SET status = 'SUSPENDED' WHERE id = $1`, [storeA]);
    // 5. anon cannot read media belonging only to suspended store
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [assetA]);
        assert.strictEqual(res.rows.length, 0, 'Anon visibility should be revoked when SUSPENDED');
    });

    // 10. authenticated tenant cannot read another organization's private media
    await withClient('authenticated', uB, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [assetA]);
        assert.strictEqual(res.rows.length, 0, 'Tenant B should not see Tenant A private media');
    });

    // 12. tenant cannot modify another organization's media
    try {
        await withClient('authenticated', uB, async (c) => {
            await c.query(`UPDATE media_assets SET storage_path = '/hacked' WHERE id = $1`, [assetA]);
        });
        // Might succeed doing nothing since they can't select it to update, so rowcount=0. Let's check rowcount or we just ensure it didn't change.
    } catch(e) {}
    const verifyAssetA = await admin.query(`SELECT storage_path FROM media_assets WHERE id = $1`, [assetA]);
    assert.strictEqual(verifyAssetA.rows[0].storage_path, '/img/a.png', 'Tenant B must not modify Tenant A media');

    // 15. external_url assets behave exactly like storage_path assets regarding RLS
    await admin.query(`UPDATE stores SET status = 'ACTIVE' WHERE id = $1`, [storeA]);
    let assetExt = '';
    await withClient('authenticated', uA, async (c) => {
      const res = await c.query(`INSERT INTO media_assets (asset_type, source_type, external_url, organization_id) VALUES ('IMAGE', 'EXTERNAL', 'https://ext.com/img.png', $1) RETURNING id`, [orgA]);
      assetExt = res.rows[0].id;
      await c.query(`INSERT INTO store_media (store_id, media_asset_id, purpose) VALUES ($1, $2, 'FAVICON')`, [storeA, assetExt]);
    });
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [assetExt]);
        assert.strictEqual(res.rows.length, 1, 'Anon SHOULD see external url media mapped to active store');
    });

    // 16. generated media metadata does not bypass RLS
    let assetGen = '';
    await withClient('authenticated', uA, async (c) => {
      const res = await c.query(`INSERT INTO media_assets (asset_type, source_type, storage_path, organization_id, metadata) VALUES ('IMAGE', 'GENERATED', '/img/gen.png', $1, '{"test": 1}') RETURNING id`, [orgA]);
      assetGen = res.rows[0].id;
    });
    await withClient('anon', null, async (c) => {
        const res = await c.query(`SELECT * FROM media_assets WHERE id = $1`, [assetGen]);
        assert.strictEqual(res.rows.length, 0, 'Anon should not see GENERATED orphan media');
    });

    console.log("All Media Security Tests PASSED.");
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
