# PUB ECOM — Payment Lifecycle Integration V1 (Plan)

## Confirmed checkpoint
HEAD=d8390429457056a725cde7a94ae07f3917aad2a6; origin/master=d839042945...; master; clean; remote=pubcoreagencia/pub-ecom.

## GATE STATUS
GATE A=PASS (Asaas sandbox outbound PIX validated in prior checkpoint); GATE B=FROZEN/NOT VALIDATED (no webhook, tunnel, or Asaas webhook registration performed in this phase); no mock declared as real.

## Main architectural finding (confirmed via audit, NOT corrected yet)
Migration 00016 (line 415-451) updates complete_checkout: inserts order PENDING_PAYMENT and converts inventory_reservations from ACTIVE -> COMMITTED (master_inventory.committed++) BEFORE any payment is confirmed. Migration 00003 maintains CHECK (on_hand - reserved - committed >= 0). This violates inventory semantics: PENDING_PAYMENT should keep RESERVED; COMMITTED is reserved only after PAID settlement (settle_payment_transaction in 00017 already handles that transition). No historical migration (00001-00016) will be edited.

## Implementation plan
New migration 00019_payment_lifecycle_inventory_correction.sql: add a safe transition (RPC or SQL function) that keeps RESERVED during PENDING_PAYMENT and defers COMMITTED until settlement RPC (settle_payment_transaction from 00017) is invoked. Existing complete_checkout RPC should not increase committed directly; instead, payment intent creation via PaymentHubService (createPaymentIntent exists in service.ts) creates payments table PENDING + payment_transactions PROCESSING; settlement RPC then commits inventory and sets order PAID. Payment API endpoint: reuse existing PaymentHubService; minimal public endpoint /api/payment/init or reuse checkout handler contract; return NormalizedPaymentResult with pixDetails; never expose rawResponse secrets; no raw secret in logs; idempotency key required; reject order already PAID or not PENDING_PAYMENT; reject provider not in registry; concurrent PROCESSING transactions blocked by uq_payment_tx_single_processing (00017). Security: CredentialCipher remains; no .env committed; APP_ENVIRONMENT=SANDBOX enforced; no production keys used.

## Tests to run
npm run typecheck; npm test (foundation, identity, tenant, catalog, media, commerce, routing, checkout, api_checkout, order_execution, payment_hub_foundation); npm run test:asaas:sandbox; verify typecheck PASS; verify full suite PASS (or document pre-existing failures); verify no new failures introduced; verify secrets not in logs; verify GATE B remains FROZEN.

## Non-changes
No second provider; no 00001-00016 edit; no full Payment Hub rewrite; no production deploy; no new tunneling/webhook real validation; no frontend redesign.
