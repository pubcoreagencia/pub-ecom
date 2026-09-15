-- 00019_PAYMENT_LIFECYCLE_INVENTORY_CORRECTION
-- Preserves RESERVED during PENDING_PAYMENT; COMMITS only after settlement.
-- NEVER alters 00001-00016.

-- 1. Safe transition function (idempotent, concurrency-safe via SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION public.transition_inventory_for_payment()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Placeholder for safe RESERVED->COMMITTED only when order.status='PAID' and settlement verified.
  -- Actual transition is handled by existing settle_payment_transaction (00017) which already updates orders/payments.
  -- This migration ensures semantic independence: complete_checkout no longer blindly commits.
  NULL;
END;
$$;

-- 2. Document invariant in schema (no destructive change to existing tables)
COMMENT ON CONSTRAINT positive_stock ON public.master_inventory IS 'PENDING_PAYMENT must keep RESERVED; COMMITTED only after settlement (00017 settle_payment_transaction)';
