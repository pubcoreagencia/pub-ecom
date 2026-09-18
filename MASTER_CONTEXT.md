# MASTER CONTEXT

## Project Identity

PUB ECOM = Central Operator / marketplace commerce foundation.
Mentorado = Sócio Investidor / authenticated platform participant.
Store = commercial boundary.

## Current Phase

ASAAS GATE B / REAL PUBLIC WEBHOOK

Payment Lifecycle V1 is merged to `master`.

Current working branch:
`master`

## Database

Production database path:
`Render → Neon Postgres`

Neon project:
- name: `pub-ecom`
- id: `small-surf-22624516`
- branch: `br-dark-hill-ac0s3y23`
- region: São Paulo
- PostgreSQL 17
- Neon Auth enabled
- Neon Data API enabled

The current ECOM schema is present through migration `00022`.
The production path uses the existing business schema with Supabase Auth references compatible with Neon Auth's managed `neon_auth.user` table.

## Runtime Compatibility

Production server database access is implemented in:
`src/lib/neon/compat.ts`

The compatibility layer preserves the existing application database surface while executing against PostgreSQL with the `pg` driver.

Supported application operations include:
- `from`
- `select`
- `eq`
- `neq`
- `is`
- `in`
- `order`
- `limit`
- `insert`
- `update`
- `delete`
- `single`
- `maybeSingle`
- `rpc`

Legacy Supabase clients remain available as the local CI fallback when `DATABASE_URL` is absent.

## Payment Lifecycle V1

SUCCESS:
- locks payment → transaction → order;
- validates relation, amount and currency;
- marks transaction SUCCESS;
- marks payment PAID;
- marks order PAID;
- converts ACTIVE inventory reservations to COMMITTED;
- decrements reserved and increments committed;
- records COMMIT movement;
- exact replay of the winning transaction is idempotent.

REJECTED:
- marks transaction FAILED;
- marks payment FAILED;
- preserves inventory reservation for retry.

Cancellation:
- CANCELLED is a successful no-op on replay;
- only PENDING_PAYMENT orders can be cancelled;
- ACTIVE reservations are released once;
- RELEASE movement is recorded.

## Asaas

Asaas Sandbox adapter is implemented for PIX.

Verified local application integration:
- outbound PIX sandbox payment creation;
- external customer reconciliation/creation;
- payment status retrieval;
- webhook verification;
- webhook deduplication;
- webhook settlement through the atomic lifecycle RPC.

REAL PUBLIC ASAAS WEBHOOK remains OPEN.

## Deployment Contract

Runtime:
`npm start`

Render:
`https://pub-ecom.onrender.com`

Health:
`GET /health → HTTP 200, {"status":"ok"}`

Webhook:
`POST /api/webhooks/payments/asaas`
or connection-specific:
`POST /api/webhooks/payments/asaas/:connectionId`

Required production server configuration:
- `DATABASE_URL`
- `NEON_AUTH_JWKS_URL`
- `ALLOWED_ORIGINS`
- `APP_ENVIRONMENT`

For the current Gate B stage:
`APP_ENVIRONMENT=SANDBOX`

Local CI fallback:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Secrets remain outside version control.

## Testing

GitHub Actions continues to validate the local Supabase regression harness.
The Neon production schema was independently verified with 44 public tables and the critical payment lifecycle RPCs present.

## Asaas Gate B

Required external proof:
1. public HTTPS endpoint;
2. Asaas Sandbox webhook configured;
3. real sandbox payment transition;
4. real POST callback received;
5. token/signature verification accepted;
6. payment/order/inventory committed;
7. replay deduplicated.

The remaining operational dependency is an active Asaas Sandbox connection in `gateway_connections`.

## Infrastructure

Render Free is the public API host.

Neon Free is the ECOM database.

Railway is not used for ECOM because its Free resource quota blocked provisioning.

## Git

Remote:
https://github.com/pubcoreagencia/pub-ecom.git

Production source of truth:
`master`
