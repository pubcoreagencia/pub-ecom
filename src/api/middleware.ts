import { createServerClient } from '../lib/supabase/server';
import { createAdminClient } from '../lib/supabase/admin';
import { createRequestContext } from '../lib/context/request';
import { TenantService } from '../services/tenant';
import { IdentityService } from '../services/identity';
import { handleApiError } from './errors';
import crypto from 'node:crypto';
import type { RequestContext } from '../lib/context/request';
import type { AuthContext } from '../lib/auth/context';
import type { TenantContext } from '../lib/context/tenant';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

export interface AppContext {
  reqCtx: RequestContext;
  authCtx: AuthContext;
  tenantCtx: TenantContext;
  db: SupabaseClient<Database>;
  adminDb: SupabaseClient<Database>;
}

export type AppHandler = (req: Request, ctx: AppContext) => Promise<Response>;

/**
 * Edge middleware that resolves the store from the request domain,
 * builds the context objects, and injects them into the handler.
 */
export function withStoreContext(handler: AppHandler): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      // 1. Extract domain
      let host = req.headers.get('host') || '';
      if (host.includes(':')) {
        host = host.split(':')[0]; // strip port for local testing
      }
      
      const url = new URL(req.url);
      const domain = host || url.hostname;

      // 2. Generate trace context
      const requestId = crypto.randomUUID();
      const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
      
      const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
      
      // 3. Initialize base clients
      const adminClient = createAdminClient();
      const userClient = createServerClient(token);

      // 4. Temporarily build an unauthenticated context to resolve the store publicly
      const initialReqCtx = createRequestContext(requestId, correlationId);
      const initialAuthCtx = { state: 'UNAUTHENTICATED' as const };
      const tenantService = new TenantService(adminClient, initialReqCtx, initialAuthCtx);
      
      // 5. Resolve Store
      const tenantCtx = await tenantService.resolveStoreFromDomain(domain);
      
      // 6. Resolve Identity using the user's token
      const identityService = new IdentityService(userClient, initialReqCtx);
      const authCtx = await identityService.resolveSession();

      // 7. Rebuild the final contextual RequestContext
      const finalReqCtx = createRequestContext(requestId, correlationId, {
        userId: authCtx.userId,
        organizationId: tenantCtx.organizationId,
        storeId: tenantCtx.storeId,
        authenticated: authCtx.state === 'AUTHENTICATED'
      });
      
      // If the user is authenticated, check if they have a customer profile in this org
      // (This usually requires calling TenantService again with the full resolved identity,
      //  but we can just query it or let the service do it. We'll let CustomerService/CartService handle the customerId resolution if needed, 
      //  or we can inject it here if we resolve the full identity).
      // For performance in Edge, we just rely on `authCtx.userId` and the repositories will look up `customer_id` via `userId` and `organization_id` internally,
      // EXCEPT `RequestContext` wants `customerId`. Let's fetch it if authenticated.
      if (authCtx.state === 'AUTHENTICATED') {
          const userId = authCtx.userId as string;
          const { data: customer } = await adminClient
            .from('customers')
            .select('id')
            .eq('organization_id', tenantCtx.organizationId!)
            .eq('user_id', userId)
            .is('deleted_at', null)
            .single();
          
          if (customer) {
            finalReqCtx.customerId = customer.id;
            tenantCtx.customerId = customer.id;
          }
      }

      const appContext: AppContext = {
        reqCtx: finalReqCtx,
        authCtx,
        tenantCtx,
        db: userClient,
        adminDb: adminClient
      };

      return await handler(req, appContext);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
