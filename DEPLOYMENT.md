# DEPLOYMENT / ASAAS GATE B

## Runtime

PUB ECOM runs as a Node.js HTTP server.

Start command:

`npm start`

Equivalent command:

`npx tsx src/api/server.ts`

The server binds to `PORT`; default is `3000`.

## Health

Public health probe:

`GET /health`

Expected response:

`200 {"status":"ok"}`

The endpoint is intentionally independent of tenant/store resolution and is suitable for a platform health check.

## Required environment

Server:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`

Public Supabase compatibility variables used by the shared config:
- `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`

Operational rule:
- production secrets must be configured only in the deployment platform;
- never commit credentials;
- service-role credentials stay server-side.

## Supabase

The deployed service must point to the intended PUB ECOM Supabase project.

Before external webhook testing, the target database must contain migrations `00001` through `00022`.

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

## Current infrastructure state

The code is deployment-ready for a Node HTTP service.

Railway provisioning is currently blocked by the account's Free-plan resource provisioning limit. No production or staging deployment is claimed from this repository checkpoint.
