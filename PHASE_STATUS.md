# PHASE STATUS

CURRENT PHASE = ASAAS GATE B / REAL PUBLIC WEBHOOK
STATUS = ZERO-COST INFRA LIVE / ASAAS ROUND-TRIP OPEN
FOUNDATION = MIGRATIONS 00001 → 00022
CURRENT BRANCH = master
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

### Zero-cost infrastructure
- Neon Free project `pub-ecom` provisioned in São Paulo.
- Neon Auth provisioned.
- Neon Data API provisioned.
- ECOM migrations `00001` → `00022` present in Neon.
- Neon verified with 44 public tables.
- Critical lifecycle RPCs verified present.
- Render Free service `pub-ecom` is live.
- Render production runtime is using Neon through `DATABASE_URL`.
- `APP_ENVIRONMENT=SANDBOX` configured for the current Gate B stage.
- Asaas provider catalog entry is present in Neon.

## CURRENT WORK

### Asaas Gate B = REAL PUBLIC WEBHOOK
OPEN.

Required external proof:
1. Public HTTPS endpoint on Render.
2. Asaas Sandbox webhook configured for the endpoint.
3. Real sandbox PIX payment transition.
4. Real POST callback from Asaas received.
5. Webhook authentication accepted.
6. Payment/order/inventory transition committed.
7. Replayed real event deduplicated.

The Render deployment and database path are operational. Real Asaas verification still requires an Asaas Sandbox credential/connection configured in `gateway_connections`.

## INFRASTRUCTURE

Render:
- Free web service: `pub-ecom`
- public URL: `https://pub-ecom.onrender.com`
- latest verified deploy status: `live`

Neon:
- Free Postgres
- project: `small-surf-22624516`
- branch: `br-dark-hill-ac0s3y23`
- region: São Paulo
- PostgreSQL 17
- 44 public tables

Railway:
- PUB ECOM remains outside Railway because its Free-plan resource quota blocked provisioning.

## NOT YET IN SCOPE

- Order post-purchase / fulfillment flow
- Shipping operational flow
- Production go-live
- Full frontend productization
