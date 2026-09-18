# MASTER CONTEXT

## Project Identity

PUB ECOM = Central Operator / marketplace commerce foundation.
Mentorado = Sócio Investidor / authenticated platform participant.
Store = commercial boundary.

## Current Phase

PAYMENT LIFECYCLE V1 = IMPLEMENTED & CI VERIFIED.

Verification commit:
`035a81bdef6c7a02ea7ee07c639c4c0db1df48ae`

Active branch:
`fix/payment-lifecycle-v1-atomic-settlement`

Pull Request:
#5 — `fix(payment): close Payment Lifecycle V1 atomic settlement`

## Database

The current schema applies cleanly through migration 00022.

Recent payment lifecycle migrations:

- 00017 = Payment Hub foundation
- 00018 = Customer gateway identities
- 00019 = Payment lifecycle inventory correction
- 00020 = Payment lifecycle inventory correction / inventory reservation lifecycle correction
- 00021 = Atomic payment + order + inventory settlement
- 00022 = Idempotent pending-payment cancellation

## Payment Lifecycle V1

Core settlement contract:

`settle_payment_lifecycle(payment, transaction, connection, verified outcome)`

SUCCESS:
- locks payment → transaction → order;
- validates relation, amount and currency;
- marks transaction SUCCESS;
- marks payment PAID;
- marks order PAID;
- converts ACTIVE inventory reservations to COMMITTED;
- decrements reserved and increments committed;
- records one COMMIT movement per reservation;
- all successful changes occur inside one database transaction;
- exact replay of the winning transaction is idempotent.

REJECTED:
- marks transaction FAILED;
- marks payment FAILED;
- preserves inventory reservation so the payment can be retried.

Cancellation contract:

`cancel_pending_payment_order(order)`

- CANCELLED is a successful no-op on replay;
- only PENDING_PAYMENT orders can be cancelled;
- ACTIVE reservations are released once;
- RELEASE movement is recorded for each released reservation.

## Asaas

Asaas Sandbox adapter is implemented for PIX.

Current verified integration:
- outbound PIX sandbox payment creation;
- external customer reconciliation/creation;
- payment status retrieval;
- webhook verification and deduplication;
- webhook settlement through the atomic lifecycle RPC.

The Asaas provider production base URL is:
`https://api.asaas.com/v3`

Sandbox base URL:
`https://api-sandbox.asaas.com/v3`

## Testing

GitHub Actions runner #22 verified the current implementation with:

- clean local Supabase startup;
- clean database reset applying migrations 00001 → 00022;
- TypeScript typecheck;
- full npm test suite;
- targeted Asaas webhook integration test.

The executable lifecycle regression verifies:
- rejection preserves RESERVED;
- successful settlement commits inventory exactly once;
- exact successful replay is idempotent;
- cancellation releases inventory exactly once;
- exact cancellation replay is idempotent.

## Security

- Payment lifecycle RPCs are SECURITY DEFINER with empty search_path.
- Public/anon/authenticated execution is revoked for lifecycle settlement and cancellation RPCs.
- Only service_role receives EXECUTE.
- Gateway credentials remain encrypted.
- Asaas webhook authentication uses the configured `asaas-access-token` secret.
- Production secrets are not stored in version control.

## External Gate B

REAL PUBLIC ASAAS WEBHOOK remains open.

The current automated webhook test proves the application integration path locally, but it does not prove that Asaas Sandbox can reach a deployed public HTTPS endpoint and trigger settlement in a deployed PUB ECOM instance.

## Deployment

Staging is not yet externally verified.
Production is not deployed.

The next operational proof is the real public Asaas Sandbox webhook round-trip, followed by deployment hardening and production readiness.

## Git

Remote:
https://github.com/pubcoreagencia/pub-ecom.git

Current working branch:
`fix/payment-lifecycle-v1-atomic-settlement`
