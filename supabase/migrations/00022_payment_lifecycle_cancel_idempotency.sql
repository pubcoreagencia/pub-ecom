-- 00022_PAYMENT_LIFECYCLE_CANCEL_IDEMPOTENCY
-- Corrects the unreachable idempotency branch in cancel_pending_payment_order().
-- CANCELLED is now a successful no-op; only PENDING_PAYMENT can perform release.

CREATE OR REPLACE FUNCTION public.cancel_pending_payment_order(
    p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order record;
    v_checkout_id uuid;
    v_res record;
BEGIN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND';
    END IF;

    -- True idempotency: a repeated cancellation is a successful no-op.
    IF v_order.status = 'CANCELLED' THEN
        RETURN true;
    END IF;

    IF v_order.status != 'PENDING_PAYMENT' THEN
        RAISE EXCEPTION 'ORDER_NOT_PENDING_PAYMENT';
    END IF;

    v_checkout_id := v_order.checkout_id;

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
            updated_at = NOW()
        WHERE master_variant_id = v_res.master_variant_id
          AND reserved >= v_res.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'INVENTORY_RESERVATION_INVARIANT_VIOLATION';
        END IF;

        UPDATE public.inventory_reservations
        SET status = 'RELEASED',
            released_at = NOW()
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
            'RELEASE',
            v_res.quantity,
            'ORDER_ITEM',
            v_order.id
        );
    END LOOP;

    UPDATE public.orders
    SET status = 'CANCELLED',
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pending_payment_order(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_pending_payment_order(uuid)
TO service_role;
