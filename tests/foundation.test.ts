import assert from 'node:assert';
import ws from 'ws';
(global as any).WebSocket = ws;
import { env } from '../src/config/env';
import { createBrowserClient } from '../src/lib/supabase/client';
import { createServerClient } from '../src/lib/supabase/server';
import { createAdminClient } from '../src/lib/supabase/admin';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../src/lib/auth/context';
import { createRequestContext } from '../src/lib/context/request';
import { createRoleContext } from '../src/lib/context/role';
import { AppError } from '../src/lib/errors/model';
import { logger } from '../src/lib/logging/logger';

// 1. Typescript compilation inherently tested by running this file with `tsx`.

async function run() {
  console.log('Running Foundation Tests...');

  // Mock Env
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

  // 2. Public config validation
  assert(env.public.SUPABASE_URL === 'http://localhost:54321');
  assert(env.public.SUPABASE_ANON_KEY === 'anon-key');
  assert(!('SUPABASE_SERVICE_ROLE_KEY' in env.public), 'Public env exposed service role');

  // 3. Server client validation
  assert(env.server.SUPABASE_SERVICE_ROLE_KEY === 'service-key');

  // Supabase imports checks
  const browserClient = createBrowserClient();
  const adminClient = createAdminClient();
  const serverClient = createServerClient('dummy-token');

  assert(browserClient !== undefined);
  assert(adminClient !== undefined);
  assert(serverClient !== undefined);

  // 4. Auth context validation
  const unauth = createUnauthenticatedContext();
  assert(unauth.state === 'UNAUTHENTICATED');
  
  const auth = createAuthenticatedContext('user-1', { accessToken: 'token' });
  assert(auth.state === 'AUTHENTICATED');
  assert(auth.userId === 'user-1');

  // 5. Request context validation
  const req = createRequestContext('req-1', 'corr-1');
  assert(req.requestId === 'req-1');
  assert(req.correlationId === 'corr-1');
  assert(req.authenticated === false);

  // 6. Application error serialization
  const err = new AppError({
    code: 'OUT_OF_STOCK',
    publicMessage: 'No stock',
    internalMessage: 'DB reserved hit max',
    httpStatus: 409,
    retryable: false,
    requestId: 'req-1'
  });
  const json = err.toJSON();
  assert(json.error.message === 'No stock');
  assert(!('internalMessage' in json.error));

  // 7. Logger recursive secret redaction
  // Overriding console to inspect
  let capturedLog = '';
  const originalDebug = console.debug;
  console.debug = (msg) => { capturedLog = msg; };
  logger.debug('test', { requestId: 'req-1' }, { 
    password: 'my-secret-pwd',
    nested: {
      accessToken: 'deep-secret',
      array: [{ service_role: 'super-secret' }]
    }
  });
  console.debug = originalDebug;

  assert(capturedLog.includes('[REDACTED]'));
  assert(!capturedLog.includes('my-secret-pwd'));
  assert(!capturedLog.includes('deep-secret'));
  assert(!capturedLog.includes('super-secret'));

  console.log('All Foundation Tests PASSED.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
