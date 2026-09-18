# PHASE STATUS

CURRENT PHASE = PAYMENT LIFECYCLE V1
STATUS = IMPLEMENTED & CI VERIFIED
FOUNDATION = MIGRATIONS 00001 → 00022
COMMERCIAL RULE = PUB TAKE RATE V1 = 15.00% (COMMERCIAL RULE V1 SNAPSHOT)

## VERIFIED Components

- Database migrations 00001 → 00022 apply successfully on a clean local Supabase reset.
- Migration 00016: Order Execution with atomic `complete_checkout`, order idempotency and economic snapshot.
- Payment Hub foundation: provider registry, scoped gateway connections, customer gateway identity, transaction idempotency and credential encryption.
- Migration 00021: atomic `settle_payment_lifecycle()` joining payment, transaction, order and inventory settlement.
- Migration 00022: idempotent `cancel_pending_payment_order()` with one-time inventory release.
- Direct payment success/rejection paths use the atomic lifecycle RPC.
- Asaas webhook settlement path uses the same atomic lifecycle RPC.
- Rejected payment preserves ACTIVE / RESERVED inventory for retry.
- Successful settlement transitions ACTIVE reservations to COMMITTED and records COMMIT movement.
- Cancellation transitions ACTIVE reservations to RELEASED and records RELEASE movement.
- Asaas webhook integration test verifies payment PAID, order PAID, transaction SUCCESS, inventory COMMITTED and duplicate-event deduplication.
- Executable Payment Lifecycle V1 regression covers rejection, successful settlement replay and cancellation replay.
- GitHub Actions validation runs local Supabase start/reset, typecheck, full test suite and targeted Asaas webhook integration.

## Validation

Verified at commit `035a81bdef6c7a02ea7ee07c639c4c0db1df48ae` by GitHub Actions runner #22:

- Supabase startup: PASS
- Database reset / migrations 00001 → 00022: PASS
- Typecheck: PASS
- Full test suite: PASS
- Targeted Asaas webhook integration: PASS

## OPEN GATES

### Asaas Gate B = REAL PUBLIC WEBHOOK

Not yet externally proven.

Required proof:
1. Publicly reachable HTTPS webhook endpoint.
2. Asaas Sandbox Webhook configured for the endpoint.
3. Real sandbox payment transition.
4. Real POST callback from Asaas received by PUB ECOM.
5. Signature/token verification accepted.
6. Payment/order/inventory transition committed.
7. Replayed real event is deduplicated.

### Deployment

- Staging deployment is not yet verified.
- Production deployment is not yet verified.
- Production credentials must never use Sandbox endpoints.

## NOT YET IN SCOPE

- Order post-purchase / fulfillment flow
- Shipping operational flow
- Production go-live
- Full frontend productization
