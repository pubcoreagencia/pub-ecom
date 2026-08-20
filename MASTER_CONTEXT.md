# MASTER CONTEXT

## Project Identity
PUB ECOM = Central Operator / marketplace commerce foundation.
Mentorado = Sócio Investidor / authenticated platform participant.
Store = commercial boundary.

## Current Phase
PHASE 3.9 = COMPLETE / VERIFIED / FROZEN

Git freeze:
d3d8c9b feat(pub-ecom): freeze phase 3.9 foundation

## Database
00001 → 00015 = FROZEN FOUNDATION

- 00001 core/enums
- 00002 identity
- 00003 catalog/inventory
- 00004 commerce
- 00005 orders/shipping foundation
- 00006 finance/audit
- 00007 RPC/RLS/security
- 00008 store platform
- 00009 media
- 00010 media security
- 00011 tracking/analytics
- 00012 cart items
- 00013 commerce transactions
- 00014 checkout transactions
- 00015 anonymous HTTP API privileges

## Application
src/api/
src/lib/
src/repositories/
src/services/
src/config/

Server entry point:
src/api/server.ts

The current runtime is a Node.js HTTP server.

## API
Router and handlers are located in:
src/api/handlers/

Currently implemented endpoints cover:
- Catalog (fetching products)
- Checkout (generating checkouts)
- Cart management (items/guest cart creation)
- Customer contexts

## Checkout
The checkout implementation relies on database transaction boundaries.
- Checkout transaction boundary: Encapsulated strictly inside PostgreSQL RPCs to avoid race conditions.
- Inventory reservation: Managed safely at the database level when creating a checkout.
- Expiration: Checkouts have defined lifecycles/expiration states.
- RPC architecture: `create_checkout` and `expire_checkout` functions execute logic securely on the server.
- Guest/customer context: The API maps anonymous guest tokens securely to cart sessions and resolves the appropriate database context.
- Relevant security boundaries: Enforced by `SECURITY DEFINER` constraints on RPCs.

## Testing
The test suite is located under:
tests/

It uses `tests/foundation.test.ts`, `tests/identity.test.ts`, `tests/tenant.test.ts`, `tests/catalog.test.ts`, `tests/commerce.test.ts`, `tests/routing.test.ts`, `tests/checkout.test.ts`, and `tests/api_checkout.test.ts`.

## Types
types/supabase.ts
is the versioned database type definition corresponding to the frozen database foundation.

## Security
- RLS: Row-Level Security is strictly enforced across all core tables.
- Authorization boundaries: App layer pre-checks role claims before forwarding tokens.
- Service-role backend usage: Strictly limited to isolated backend operations (like creating tenants or internal cart resolution). Never exposed.
- CORS: Managed dynamically by `src/api/cors.ts` mapping to `ALLOWED_ORIGINS`.
- Environment-based secrets: Stored externally via `.env` (not versioned).
- Anonymous HTTP API privilege model: The `anon` role is meticulously granted explicit SELECT and EXECUTE access where strictly needed (migration 00015).
- Checkout RPC security: Handled via `SECURITY DEFINER` and internal validations.

## Deployment
Recommended staging target:
Render Web Service

Current runtime:
Node.js

Current entry point:
src/api/server.ts

Current planned start command:
npx tsx src/api/server.ts

Current planned deterministic dependency installation:
npm ci

STAGING IS NOT DEPLOYED.
Render is only the planned staging target.
Cloudflare Workers/Pages Functions are NOT currently compatible without a platform-specific entry adapter.
Vercel requires an adapter/entry-point change.

## Git
Current frozen commit:
d3d8c9b

Remote:
https://github.com/pubcoreagencia/pub-ecom.git

GitHub publication may still depend on local authentication if the repository has not yet been successfully pushed.

## Current Status
COMPLETE: HTTP API, Catalog, Checkout RPCs, Routing, Tests.
FROZEN: Database (00015), Application layer, Security RLS.
PLANNED: Render Staging Deployment.
NOT IMPLEMENTED: Order post-purchase flow, Payment integrations, Finance operational layer, Shipping operational flow, Frontend Next.js app.
