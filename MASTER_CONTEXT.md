# MASTER CONTEXT

## Project Identity

PUB ECOM = Central Operator / marketplace commerce foundation.
Mentorado = Sócio Investidor / authenticated platform participant.
Store = commercial boundary.

## Current Phase

ASAAS GATE B / DEPLOYMENT READINESS

Payment Lifecycle V1 is merged to `master` at:
`b8665b7c9c106caa9142d5ca52a463031c424482`

Deployment readiness is merged to `master` at:
`0089889f8261476478375caa0cc127d47d8dabb5`

Current master baseline:
`0089889f8261476478375caa0cc127d47d8dabb5`

## Database

The current schema applies cleanly through migration 00022.

Recent payment lifecycle migrations:
- 00017 = Payment Hub foundation
- 00018 = Customer gateway identities
- 00019 = Payment lifecycle inventory correction
- 00020 = reservation lifecycle correction
- 00021 = atomic payment + order + inventory settlement
- 00022 = idempotent pending-payment cancellation

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

Sandbox:
`https://api-sandbox.asaas.com/v3`

Production:
`https://api.asaas.com/v3`

## Deployment Contract

Runtime:
`npm start`

Server:
- binds to `PORT`;
- default port is 3000.

Health:
`GET /health` → HTTP 200, `{"status":"ok"}`

Webhook:
`POST /api/webhooks/payments/asaas`
or connection-specific:
`POST /api/webhooks/payments/asaas/:connectionId`

Required server configuration:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`

Supabase public compatibility variables:
- `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`

Secrets remain outside version control and service-role credentials remain server-only.

## Testing

GitHub Actions runner #23 passed:
- clean local Supabase startup;
- clean database reset through migrations 00001 → 00022;
- TypeScript typecheck;
- full npm test suite;
- executable Payment Lifecycle V1 regression;
- targeted Asaas webhook integration.

## Asaas Gate B

REAL PUBLIC ASAAS WEBHOOK remains OPEN.

The local webhook integration test does not prove a deployed public HTTPS round-trip.

Required external proof:
1. public HTTPS endpoint;
2. Asaas Sandbox webhook configured;
3. real sandbox payment transition;
4. real POST callback received;
5. token/signature verification accepted;
6. payment/order/inventory committed;
7. replay deduplicated.

## Infrastructure

Railway provisioning is currently blocked by the Free-plan resource provisioning limit. No staging or production deployment is claimed.

## Git

Remote:
https://github.com/pubcoreagencia/pub-ecom.git

`master` baseline:
`0089889f8261476478375caa0cc127d47d8dabb5`
