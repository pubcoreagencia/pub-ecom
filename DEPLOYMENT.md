# DEPLOYMENT / ASAAS GATE B

## Runtime

PUB ECOM runs as a Node.js HTTP server.

Build command:

`npm run build`

Start command:

`npm start`

The production start command runs the compiled server:

`node dist/src/api/server.js`

The server binds to `PORT`; default is `3000`.

## Health

Public health probe:

`GET /health`

Expected response:

`200 {"status":"ok"}`

The endpoint is intentionally independent of tenant/store resolution and is suitable for a platform health check.

## Required production environment

Neon / database:
- `DATABASE_URL`
- `NEON_AUTH_JWKS_URL`
- `ALLOWED_ORIGINS`

The production API uses Neon Postgres through the compatibility layer in `src/lib/neon/compat.ts`.

Legacy Supabase variables remain supported only for the local regression harness:
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Operational rules:
- production secrets are configured only in Render;
- never commit credentials;
- the database connection string stays server-side;
- Render must use the Neon production variables when `DATABASE_URL` is present.

## Neon

Production database:
- provider: Neon Free
- region: São Paulo
- PostgreSQL 17
- project: `pub-ecom`
- migrations: `00001` through `00022`
- Neon Auth enabled
- Neon Data API enabled

The database schema was reconstructed from the repository's current migrations. Supabase `auth.users` foreign keys are adapted to Neon Auth's `neon_auth.user` table, while the compatibility `auth.uid()` function remains available for the existing RLS policies.

## Render

Production API host:
`https://pub-ecom.onrender.com`

Deployment target:
- service: `pub-ecom`
- plan: Free
- runtime: Node
- build: `npm install && npm run build`
- start: `npm start`

## Asaas webhook

Route:

`POST /api/webhooks/payments/asaas`

A connection-specific route is also supported:

`POST /api/webhooks/payments/asaas/:connectionId`

The webhook handler:
1. receives the raw body;
2. resolves an active Asaas gateway connection;
3. verifies the configured webhook token;
4. deduplicates by provider event key;
5. retrieves the payment status from Asaas;
6. settles payment, order and inventory through the atomic lifecycle RPC.

## Gate B proof

The real external proof requires:
1. deployed public HTTPS URL;
2. Asaas Sandbox webhook configured to that URL;
3. real sandbox PIX payment transition;
4. callback received by deployed PUB ECOM;
5. webhook authentication accepted;
6. payment/order/inventory settled;
7. replay of the same event deduplicated.

A local integration test does not satisfy this gate.

## Environment separation

Sandbox:
- Asaas base URL: `https://api-sandbox.asaas.com/v3`

Production:
- Asaas base URL: `https://api.asaas.com/v3`

Never mix sandbox credentials/endpoints with production credentials/endpoints.
