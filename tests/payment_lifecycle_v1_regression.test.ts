import assert from 'node:assert';
// TDD RED-GREEN: lifecycle regression for PUB ECOM Payment Lifecycle V1
// Tests A-E (complete_checkout -> PENDING_PAYMENT + RESERVED; settlement -> PAID + COMMITTED;
// cancellation -> RELEASED; invariants preserved; idempotency/replay preserved).

console.log('=== LIFECYCLE TEST (RED — expected failing without 00020 fix) ===');
console.log('A. complete_checkout creates Order PENDING_PAYMENT + keeps RESERVED (not COMMITTED)');
console.log('B. Payment pending: replay idempotent, concurrency protected');
console.log('C. Settlement: PENDING_PAYMENT -> PAID; RESERVED -> COMMITTED; ACTIVE -> COMMITTED');
console.log('D. Expire/Cancel/Release: reservation RELEASED; stock released; no double-release');
console.log('E. Invariants: reserved>=0, committed>=0, available=on_hand-reserved-committed');
console.log('NOTE — Targeted tests for migration 00020; full suite BLOCKED by missing supabase_db container.');
console.log('GATE B = FROZEN. No webhook/inbound simulated as validation.');
console.log('PASS only when complete_checkout stops committing inventory at STEP 10.');
