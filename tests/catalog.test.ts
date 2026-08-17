import assert from 'node:assert';
import ws from 'ws';
(global as any).WebSocket = ws;
import { createBrowserClient } from '../src/lib/supabase/client';
import { createRequestContext } from '../src/lib/context/request';
import { createAuthenticatedContext } from '../src/lib/auth/context';
import { resolveTenantContext } from '../src/lib/context/tenant';
import { CatalogService } from '../src/services/catalog';
import { AppError } from '../src/lib/errors/model';

async function run() {
  console.log('Running Catalog Tests...');

  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'anon-key';

  const db = createBrowserClient();
  const ctx = createRequestContext('req-id', 'corr-id');
  const auth = createAuthenticatedContext('user-1', { accessToken: 'fake' });
  const tenant = resolveTenantContext('org-1', 'store-1', undefined);
  
  const service = new CatalogService(db, ctx, auth, tenant);

  // Mock Repo
  const repo = (service as any).repo;
  repo.getStoreProducts = async (storeId: string) => {
    if (storeId === 'store-1') return [{ id: 'sp-1', master_product_id: 'mp-1', title: 'Test SP', slug: 'test-sp', status: 'ACTIVE' }];
    return [];
  };
  
  repo.getStoreProductDetail = async (storeProductId: string, storeId: string) => {
    if (storeProductId === 'sp-1' && storeId === 'store-1') {
      return {
        product: { id: 'sp-1', master_product_id: 'mp-1', title: 'Test SP', slug: 'test-sp', status: 'ACTIVE', seo_data: null },
        variants: [
          { id: 'sv-1', master_variant_id: 'mv-1', store_product_id: 'sp-1', sale_price: 100, compare_at_price: null, is_active: true }
        ]
      };
    }
    return null; // Not found or doesn't belong to store
  };

  repo.getMasterProduct = async (mpId: string) => {
    return { id: mpId, base_sku: 'BASE-1', description: 'Desc', supplier_id: 'sup-1', name: 'Master', status: 'ACTIVE' };
  };

  repo.getMasterVariants = async (mpId: string) => {
    return [
      { id: 'mv-1', master_product_id: mpId, sku: 'BASE-1-A', cost_price: 50, weight_grams: 100 }
    ];
  };

  repo.getInventory = async (mvIds: string[]) => {
    return [
      { id: 'inv-1', master_variant_id: 'mv-1', on_hand: 10, reserved: 2, committed: 0 } // available = 8
    ];
  };

  // 1. Resolve store catalog (valid store)
  const catalog = await service.resolveStoreCatalog();
  assert(catalog.length === 1);
  assert(catalog[0].storeProductId === 'sp-1');
  assert(catalog[0].masterProductId === 'mp-1');

  // 2. Resolve store product details + master join + inventory
  const detail = await service.resolveStoreProduct('sp-1');
  assert(detail.storeProductId === 'sp-1');
  assert(detail.masterData.baseSku === 'BASE-1');
  assert(detail.variants.length === 1);
  assert(detail.variants[0].sku === 'BASE-1-A');
  assert(detail.variants[0].inventory.available === 8);
  assert(detail.variants[0].inventory.reserved === 2);

  // 3. Invalid store product traversal (StoreProduct doesn't exist or isn't in Tenant's store)
  try {
    await service.resolveStoreProduct('sp-2-from-other-store');
    assert.fail('Should have thrown');
  } catch (err: any) {
    assert(err instanceof AppError);
    assert(err.httpStatus === 404); // Not found or cross-store rejected
  }

  // 4. Invalid Tenant Context
  const badTenant = resolveTenantContext('org-1', undefined, undefined);
  const badService = new CatalogService(db, ctx, auth, badTenant);
  try {
    await badService.resolveStoreCatalog();
    assert.fail('Should have thrown');
  } catch (err: any) {
    assert(err instanceof AppError);
    assert(err.code === 'TENANT_ACCESS_ERROR');
  }

  console.log('All Catalog Tests PASSED.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
