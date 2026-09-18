-- 00021_PAYMENT_LIFECYCLE_ATOMIC_SETTLEMENT
-- Makes payment settlement and inventory commitment one atomic database operation.
-- Replaces the split settle_payment_transaction() + settle_payment_inventory() path.

CREATE OR REPLACE FUNCTION public.settle_payment_lifecycle(
    p_payment_id uuid,
    p_transaction_id uuid,
    p_connection_id uuid,
    p_transaction_id_external text,
    p_verified_amount numeric(15,2),
    p_verified_currency text,
    p_gateway_fee numeric(15,2),
    p_net_amount numeric(15,2),
    p_verified_outcome text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment record;
    v_tx record;
    v_order record;
    v_checkout_id uuid;
    v_res record;
BEGIN
    -- Lock in deterministic order: payment -> transaction -> order.
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;

    SELECT * INTO v_tx
    FROM public.payment_transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'; END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = v_payment.order_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

    -- Structural linkage checks.
    IF v_tx.payment_id != v_payment.id THEN
        RAISE EXCEPTION 'TRANSACTION_PAYMENT_MISMATCH';
    END IF;

    IF v_tx.gateway_connection_id != p_connection_id THEN
        RAISE EXCEPTION 'TRANSACTION_CONNECTION_MISMATCH';
    END IF;

    IF p_verified_outcome NOT IN ('SUCCESS', 'REJECTED') THEN
        RAISE EXCEPTION 'INVALID_OUTCOME';
    END IF;

    -- A previously settled payment is immutable except for a replay of its
    -- exact winning transaction.
    IF v_payment.status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK') THEN
        IF p_verified_outcome = 'SUCCESS' AND v_payment.settled_transaction_id = p_transaction_id THEN
            RETURN true;
        END IF;
        RAISE EXCEPTION 'PAYMENT_ALREADY_SETTLED_BY_ANOTHER_TRANSACTION';
    END IF;

    -- Economic invariants are required for both success and rejection.
    IF p_verified_amount != v_payment.gross_amount
       OR p_verified_amount != v_order.total_amount THEN
        RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH';
    END IF;

    IF p_verified_currency != v_payment.currency
       OR p_verified_currency != v_order.currency THEN
        RAISE EXCEPTION 'PAYMENT_CURRENCY_MISMATCH';
    END IF;

    IF v_tx.status != 'PROCESSING' THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_IN_PROCESSING';
    END IF;

    IF p_verified_outcome = 'REJECTED' THEN
        UPDATE public.payment_transactions
        SET status = 'FAILED',
            transaction_id_external = p_transaction_id_external
        WHERE id = p_transaction_id;

        UPDATE public.payments
        SET status = 'FAILED',
            updated_at = NOW()
        WHERE id = p_payment_id;

        -- Inventory intentionally remains RESERVED so a retry can reuse it.
        RETURN false;
    END IF;

    -- SUCCESS: payment, order, transaction and inventory commit happen in
    -- this single database transaction.
    UPDATE public.payment_transactions
    SET status = 'SUCCESS',
        transaction_id_external = p_transaction_id_external
    WHERE id = p_transaction_id;

    UPDATE public.payments
    SET status = 'PAID',
        gateway_fee = p_gateway_fee,
        net_amount = p_net_amount,
        settled_gateway_connection_id = p_connection_id,
        settled_transaction_id = p_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id;

    UPDATE public.orders
    SET status = 'PAID',
        updated_at = NOW()
    WHERE id = v_payment.order_id;

    v_checkout_id := v_order.checkout_id;

    -- Lock reservations deterministically. If there are no reservations,
    -- settlement remains valid for legacy/manual orders without inventory.
    FOR v_res IN (
        SELECT id, master_variant_id, quantity
        FROM public.inventory_reservations
        WHERE checkout_id = v_checkout_id
          AND status = 'ACTIVE'
        ORDER BY master_variant_id ASC, id ASC
        FOR UPDATE
    ) LOOP
        UPDATE public.master_inventory
        SET reserved = reserved - v_res.quantity,
            committed = committed + v_res.quantity,
            updated_at = NOW()
        WHERE master_variant_id = v_res.master_variant_id
          AND reserved >= v_res.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'INVENTORY_RESERVATION_INVARIANT_VIOLATION';
        END IF;

        UPDATE public.inventory_reservations
        SET status = 'COMMITTED'
        WHERE id = v_res.id
          AND status = 'ACTIVE';

        INSERT INTO public.inventory_movements (
            master_variant_id,
            movement_type,
            quantity,
            reference_type,
            reference_id
        )
        VALUES (
            v_res.master_variant_id,
            'COMMIT',
            v_res.quantity,
            'ORDER_ITEM',
            v_order.id
        );
    END LOOP;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_payment_lifecycle(
    uuid, uuid, uuid, text, numeric, text, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.settle_payment_lifecycle(
    uuid, uuid, uuid, text, numeric, text, numeric, numeric, text
) TO service_role;
