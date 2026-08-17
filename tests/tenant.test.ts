import assert from 'node:assert';
import ws from 'ws';
(global as any).WebSocket = ws;
import { createBrowserClient } from '../src/lib/supabase/client';
import { createRequestContext } from '../src/lib/context/request';
import { createAuthenticatedContext } from '../src/lib/auth/context';
import { TenantService } from '../src/services/tenant';
import type { ResolvedIdentity } from '../src/services/identity';
import { AppError } from '../src/lib/errors/model';

async function run() {
  console.log('Running Tenant Tests...');

  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  
  const db = createBrowserClient();
  const ctx = createRequestContext('req-id', 'corr-id');
  const auth = createAuthenticatedContext('user-1', { accessToken: 'fake' });
  const service = new TenantService(db, ctx, auth);

  // Mock Repo
  const repo = (service as any).repo;
  repo.getOrganization = async (orgId: string) => {
    if (orgId === 'org-missing-db') return null;
    return { id: orgId, name: 'Test Org', status: 'ACTIVE', created_at: null, updated_at: null, document: null };
  };
  repo.getStore = async (storeId: string) => {
    if (storeId === 'store-invalid') return null;
    if (storeId === 'store-org2') return { id: storeId, organization_id: 'org-2', name: 'Store 2', slug: 'st2', status: 'ACTIVE', created_at: null, updated_at: null };
    return { id: storeId, organization_id: 'org-1', name: 'Store 1', slug: 'st1', status: 'ACTIVE', created_at: null, updated_at: null };
  };

  const identity: ResolvedIdentity = {
    user: { id: 'user-1', email: 'u@pub.com', full_name: 'U', created_at: null, updated_at: null },
    memberships: [
      { organizationId: 'org-1', role: 'OWNER' }
    ],
    customers: [
      { organizationId: 'org-1', customerId: 'cust-1' }
    ]
  };

  // A. authenticated user resolves organization
  const tenantOrg1 = await service.resolveOrganizationContext(identity, 'org-1');
  assert(tenantOrg1.isResolved === true);
  assert(tenantOrg1.organizationId === 'org-1');
  assert(tenantOrg1.storeId === undefined);

  // F. invalid organization traversal is rejected (user is not in org-2)
  try {
    await service.resolveOrganizationContext(identity, 'org-2');
    assert.fail('Should have thrown TENANT_ACCESS_ERROR');
  } catch (err: any) {
    assert(err instanceof AppError);
    assert(err.code === 'TENANT_ACCESS_ERROR');
  }

  // E. store resolves from valid organization context
  const tenantStore1 = await service.resolveStoreContext(identity, 'store-1');
  assert(tenantStore1.isResolved === true);
  assert(tenantStore1.organizationId === 'org-1');
  assert(tenantStore1.storeId === 'store-1');
  assert(tenantStore1.customerId === 'cust-1'); // Customer mapped successfully

  // H. cross-tenant traversal fails safely (store-org2 belongs to org-2, where user has no membership)
  try {
    await service.resolveStoreContext(identity, 'store-org2');
    assert.fail('Should have thrown TENANT_ACCESS_ERROR');
  } catch (err: any) {
    assert(err instanceof AppError);
    assert(err.code === 'TENANT_ACCESS_ERROR');
  }

  // G. invalid store traversal is rejected (store missing in DB)
  try {
    await service.resolveStoreContext(identity, 'store-invalid');
    assert.fail('Should have thrown INTERNAL_ERROR 404');
  } catch (err: any) {
    assert(err instanceof AppError);
    assert(err.httpStatus === 404);
  }

  console.log('All Tenant Tests PASSED.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
