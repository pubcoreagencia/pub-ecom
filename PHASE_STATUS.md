# PHASE STATUS

CURRENT PHASE = ASAAS GATE B / DEPLOYMENT READINESS
STATUS = CODE READY / EXTERNAL INFRASTRUCTURE BLOCKED
FOUNDATION = MIGRATIONS 00001 → 00022
MASTER BASELINE = b8665b7c9c106caa9142d5ca52a463031c424482
COMMERCIAL RULE = PUB TAKE RATE V1 = 15.00% (COMMERCIAL RULE V1 SNAPSHOT)

## CLOSED

### Payment Lifecycle V1
- Atomic `settle_payment_lifecycle()` merged to `master`.
- Rejected payment preserves ACTIVE / RESERVED inventory for retry.
- Successful settlement transitions ACTIVE reservations to COMMITTED and records COMMIT movement atomically.
- Cancellation transitions ACTIVE reservations to RELEASED and is idempotent on replay.
- Direct payment and Asaas webhook settlement paths use the same lifecycle RPC.
- Executable lifecycle regression covers rejection, success replay and cancellation replay.
- Asaas webhook integration test covers settlement and duplicate-event deduplication.
- GitHub Actions runner #23 passed Supabase startup/reset, migrations 00001 → 00022, typecheck, full suite and targeted Asaas webhook integration.
- PR #5 was merged to `master` as commit `b8665b7c9c106caa9142d5ca52a463031c424482`.

## CURRENT WORK

### Deployment Readiness
- `npm start` is defined for the Node HTTP server.
- `GET /health` returns HTTP 200 with `{"status":"ok"}`.
- Routing regression covers the health probe and unsupported methods.
- `DEPLOYMENT.md` documents runtime, variables, webhook route, environment separation and Gate B proof.

### Asaas Gate B = REAL PUBLIC WEBHOOK
OPEN.

Required proof:
1. Publicly reachable HTTPS webhook endpoint.
2. Asaas Sandbox Webhook configured for the endpoint.
3. Real sandbox payment transition.
4. Real POST callback from Asaas received by deployed PUB ECOM.
5. Signature/token verification accepted.
6. Payment/order/inventory transition committed.
7. Replayed real event is deduplicated.

## INFRASTRUCTURE BLOCKER

Railway account provisioning currently returns:
`Free plan resource provision limit exceeded. Please upgrade to provision more resources!`

No staging or production deployment is claimed.

## NOT YET IN SCOPE

- Order post-purchase / fulfillment flow
- Shipping operational flow
- Production go-live
- Full frontend productization
