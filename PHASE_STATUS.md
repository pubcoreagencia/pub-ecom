# PHASE STATUS

CURRENT PHASE = ASAAS GATE B / ZERO-COST PUBLIC DEPLOYMENT
STATUS = NEON + RENDER READY / REAL ASAAS ROUND-TRIP OPEN
FOUNDATION = MIGRATIONS 00001 → 00022
MASTER BASELINE = 0089889f8261476478375caa0cc127d47d8dabb5
CURRENT BRANCH = feat/neon-render-zero-cost
COMMERCIAL RULE = PUB TAKE RATE V1 = 15.00% (COMMERCIAL RULE V1 SNAPSHOT)

## CLOSED

### Payment Lifecycle V1
- Atomic settlement merged to `master`.
- Rejected payment preserves ACTIVE / RESERVED inventory for retry.
- Successful settlement transitions ACTIVE reservations to COMMITTED and records COMMIT movement atomically.
- Cancellation transitions ACTIVE reservations to RELEASED and is idempotent on replay.
- Direct payment and Asaas webhook settlement paths use the same lifecycle RPC.
- Executable lifecycle regression covers rejection, success replay and cancellation replay.
- Asaas webhook integration test covers settlement and duplicate-event deduplication.

### Zero-cost infrastructure foundation
- Neon Free project `pub-ecom` provisioned in São Paulo.
- Neon Auth provisioned.
- Neon Data API provisioned.
- Current ECOM migrations `00001` → `00022` applied to Neon.
- Render Free web service `pub-ecom` exists at `https://pub-ecom.onrender.com`.

## CURRENT WORK

### Runtime migration
- Production database client routes to Neon.
- Local CI keeps the existing Supabase fallback.
- `pg` is a runtime dependency.
- Nested PostgREST relation reads were replaced with explicit lookups in the two affected repositories.
- PR #8 contains the production runtime migration.

### Asaas Gate B = REAL PUBLIC WEBHOOK
OPEN.

Required proof:
1. Public HTTPS endpoint on Render.
2. Asaas Sandbox webhook configured for the endpoint.
3. Real sandbox payment transition.
4. Real POST callback from Asaas received.
5. Webhook authentication accepted.
6. Payment/order/inventory transition committed.
7. Replayed real event deduplicated.

## INFRASTRUCTURE

Render:
- Free web service: `pub-ecom`
- public URL: `https://pub-ecom.onrender.com`

Neon:
- Free Postgres
- project: `small-surf-22624516`
- region: São Paulo
- PostgreSQL 17
- 44 public tables currently present after migration.

Railway:
- PUB ECOM provisioning remains blocked by the account's Free-plan resource provisioning limit.
- Railway is not part of the production ECOM path.

## NOT YET IN SCOPE

- Order post-purchase / fulfillment flow
- Shipping operational flow
- Production go-live
- Full frontend productization
