import assert from 'node:assert';
import ws from 'ws';
(global as any).WebSocket = ws;
import { env } from '../src/config/env';
import { createBrowserClient } from '../src/lib/supabase/client';
import { createRequestContext } from '../src/lib/context/request';
import { IdentityService } from '../src/services/identity';
import { AppError } from '../src/lib/errors/model';

async function run() {
  console.log('Running Identity Tests...');

  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  
  const db = createBrowserClient();
  const ctx = createRequestContext('req-id', 'corr-id');
  const service = new IdentityService(db, ctx);

  // A. no session -> UNAUTHENTICATED
  // Mocking getSession to return null
  const originalAuthGetUser = db.auth.getUser;
  db.auth.getUser = async () => ({ data: { user: null }, error: null }) as any;
  
  const unauthContext = await service.resolveSession();
  assert(unauthContext.state === 'UNAUTHENTICATED');

  // B. valid session -> AUTHENTICATED
  db.auth.getUser = async () => ({ 
    data: { 
      user: {
        id: 'user-123',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } 
    }, 
    error: null 
  }) as any;

  const authContext = await service.resolveSession();
  assert(authContext.state === 'AUTHENTICATED');
  assert(authContext.userId === 'user-123');

  // C. invalid session handling (error returned by supabase)
  db.auth.getUser = async () => ({ data: { user: null }, error: { name: 'AuthError', message: 'Fake err' } as any });
  const errContext = await service.resolveSession();
  assert(errContext.state === 'UNAUTHENTICATED');

  // Restore
  db.auth.getUser = originalAuthGetUser;

  // Since we cannot run destructive DB ops, we will mock the repo inside the service for resolution tests
  const repo = (service as any).repo;
  repo.getUser = async (userId: string) => {
    if (userId === 'not-found') return null;
    return { id: userId, email: 'test@pub.com', full_name: 'Test User', created_at: null, updated_at: null };
  };
  repo.getMemberships = async (userId: string) => {
    return [
      { id: 'm1', organization_id: 'org-1', user_id: userId, role: 'OWNER', created_at: null }
    ];
  };
  repo.getCustomers = async (userId: string) => {
    return [
      { id: 'c1', organization_id: 'org-1', user_id: userId, email: 'test@pub.com', full_name: 'Test', document: null, created_at: null, deleted_at: null }
    ];
  };

  // C, E, F: Resolve user, memberships, customers
  const identity = await service.resolveIdentity('user-123');
  assert(identity.user.email === 'test@pub.com');
  assert(identity.memberships.length === 1);
  assert(identity.memberships[0].organizationId === 'org-1');
  assert(identity.memberships[0].role === 'OWNER');
  assert(identity.customers.length === 1);
  assert(identity.customers[0].organizationId === 'org-1');
  assert(identity.customers[0].customerId === 'c1');

  // C. user_id resolution (not found -> AppError)
  try {
    await service.resolveIdentity('not-found');
    assert.fail('Should have thrown');
  } catch (err: any) {
    assert(err instanceof AppError);
    assert(err.code === 'AUTHENTICATION_ERROR');
    assert(err.httpStatus === 404);
  }

  console.log('All Identity Tests PASSED.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
