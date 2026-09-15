-- 00020_PAYMENT_LIFECYCLE_INVENTORY_CORRECTION (CORRECTIVE — no 00001-00018 edits)
-- Replaces `complete_checkout` behavior: removes STEP 10 (RESERVED->COMMITTED) so that
-- `PENDING_PAYMENT` orders preserve inventory as RESERVED. Adds `settle_payment_inventory()`
-- (called after `settle_payment_transaction`) to transition RESERVED -> COMMITTED
-- atomically, with idempotency and deterministic locking.
-- Adds `cancel_pending_payment_order()` to release RESERVED inventory on PENDING_PAYMENT orders
-- (timeout/cancel path). Gate B remains FROZEN.

-- 1. Redefine complete_checkout (no COMMITTED during checkout; only RESERVED preserved)
CREATE OR REPLACE FUNCTION public.complete_checkout(
    p_checkout_id uuid,
    p_shipping_quote_id uuid,
    p_shipping_address jsonb,
    p_customer_info jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_checkout_status text;
    v_checkout_cart_id uuid;
    v_checkout_store_id uuid;
    v_cart_status text;
    v_cart_customer_id uuid;
    v_cart_store_id uuid;
    v_cart_guest_hash text;
    v_organization_id uuid;
    v_final_customer_id uuid;
    v_guest_email text;
    v_guest_name text;
    v_guest_document text;
    v_quote_carrier text;
    v_quote_service text;
    v_quote_price numeric(15,2);
    v_quote_days integer;
    v_addr_recipient text;
    v_addr_postal text;
    v_addr_street text;
    v_addr_number text;
    v_addr_city text;
    v_addr_state text;
    v_addr_phone text;
    v_addr_neighborhood text;
    v_addr_country text;
    v_order_number text;
    v_final_order_total numeric(15,2) := 0.00;
    v_new_order_id uuid;
    v_existing_order_id uuid;
    v_cart_item record;
    v_res record;
    v_cart_item_count integer := 0;
    v_item_gmv numeric(15,2);
    v_pub_unit_margin numeric(15,2);
    v_pub_item_margin numeric(15,2);
    v_gross_item_margin numeric(15,2);
    v_merchant_item_margin numeric(15,2);
BEGIN
    -- STEP 1: Lock and Inspect Checkout
    SELECT status, cart_id, store_id
    INTO v_checkout_status, v_checkout_cart_id, v_checkout_store_id
    FROM checkouts
    WHERE id = p_checkout_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'checkout_not_found'; END IF;

    IF v_checkout_status = 'COMPLETED' THEN
        SELECT id INTO v_existing_order_id FROM orders WHERE checkout_id = p_checkout_id;
        IF v_existing_order_id IS NOT NULL THEN RETURN v_existing_order_id;
        ELSE RAISE EXCEPTION 'invariant_violation_completed_checkout_without_order';
        END IF;
    END IF;
    IF v_checkout_status = 'EXPIRED' THEN RAISE EXCEPTION 'checkout_expired'; END IF;
    IF v_checkout_status != 'IN_PROGRESS' THEN RAISE EXCEPTION 'checkout_not_in_progress'; END IF;

    -- STEP 2: Lock and Inspect Cart
    SELECT status, customer_id, store_id, guest_token_hash
    INTO v_cart_status, v_cart_customer_id, v_cart_store_id, v_cart_guest_hash
    FROM carts WHERE id = v_checkout_cart_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'cart_not_found'; END IF;
    IF v_cart_store_id != v_checkout_store_id THEN RAISE EXCEPTION 'store_mismatch'; END IF;

    SELECT organization_id INTO v_organization_id FROM stores WHERE id = v_checkout_store_id AND status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_store'; END IF;

    -- STEP 3: Customer Resolution
    IF v_cart_customer_id IS NOT NULL THEN
        PERFORM 1 FROM customers WHERE id = v_cart_customer_id AND organization_id = v_organization_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized_customer'; END IF;
        v_final_customer_id := v_cart_customer_id;
    ELSE
        IF p_customer_info IS NULL THEN RAISE EXCEPTION 'missing_customer_info'; END IF;
        v_guest_email := TRIM(COALESCE(p_customer_info->>'email', ''));
        v_guest_name := TRIM(COALESCE(p_customer_info->>'full_name', ''));
        v_guest_document := TRIM(COALESCE(p_customer_info->>'document', ''));
        IF v_guest_email = '' THEN RAISE EXCEPTION 'missing_guest_email'; END IF;
        IF v_guest_name = '' THEN RAISE EXCEPTION 'missing_guest_name'; END IF;
        IF v_guest_document = '' THEN RAISE EXCEPTION 'missing_guest_document'; END IF;
        INSERT INTO customers (organization_id, user_id, email, full_name, document)
        VALUES (v_organization_id, NULL, v_guest_email, v_guest_name, v_guest_document)
        RETURNING id INTO v_final_customer_id;
    END IF;

    -- STEP 4: Shipping (same as 00016)
    IF p_shipping_quote_id IS NULL THEN RAISE EXCEPTION 'missing_shipping_quote'; END IF;
    SELECT carrier, service_name, price, estimated_days
    INTO v_quote_carrier, v_quote_service, v_quote_price, v_quote_days
    FROM shipping_quotes WHERE id = p_shipping_quote_id AND checkout_id = p_checkout_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_shipping_quote'; END IF;
    IF p_shipping_address IS NULL THEN RAISE EXCEPTION 'missing_shipping_address'; END IF;
    v_addr_recipient := TRIM(COALESCE(p_shipping_address->>'recipient_name', ''));
    v_addr_postal := TRIM(COALESCE(p_shipping_address->>'postal_code', ''));
    v_addr_street := TRIM(COALESCE(p_shipping_address->>'street', ''));
    v_addr_number := TRIM(COALESCE(p_shipping_address->>'number', ''));
    v_addr_city := TRIM(COALESCE(p_shipping_address->>'city', ''));
    v_addr_state := TRIM(COALESCE(p_shipping_address->>'state', ''));
    v_addr_phone := TRIM(COALESCE(p_shipping_address->>'phone', ''));
    v_addr_neighborhood := TRIM(COALESCE(p_shipping_address->>'neighborhood', ''));
    v_addr_country := COALESCE(NULLIF(TRIM(p_shipping_address->>'country'), ''), 'BR');
    IF v_addr_recipient = '' OR v_addr_postal = '' OR v_addr_street = '' OR v_addr_number = '' OR v_addr_city = '' OR v_addr_state = '' THEN
        RAISE EXCEPTION 'invalid_shipping_address'; END IF;

    -- STEP 5: Reservations Integrity (same validation; keep ACTIVE)
    SELECT COUNT(*) INTO v_cart_item_count FROM cart_items WHERE cart_id = v_checkout_cart_id;
    IF v_cart_item_count = 0 THEN RAISE EXCEPTION 'empty_cart'; END IF;
    PERFORM id FROM inventory_reservations WHERE checkout_id = p_checkout_id AND status = 'ACTIVE' FOR UPDATE;
    FOR v_res IN (
        SELECT spv.master_variant_id, SUM(ci.quantity) AS expected_qty
        FROM cart_items ci JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
        WHERE ci.cart_id = v_checkout_cart_id
        GROUP BY spv.master_variant_id
        ORDER BY spv.master_variant_id ASC
    ) LOOP
        DECLARE v_actual_res_qty integer;
        BEGIN
            SELECT COALESCE(SUM(quantity), 0) INTO v_actual_res_qty FROM inventory_reservations
            WHERE checkout_id = p_checkout_id AND master_variant_id = v_res.master_variant_id AND status = 'ACTIVE';
            IF v_actual_res_qty != v_res.expected_qty THEN RAISE EXCEPTION 'reservation_mismatch'; END IF;
        END;
    END LOOP;

    -- STEP 6: Totals & Margin Validation
    FOR v_cart_item IN (
        SELECT ci.quantity, ci.store_product_variant_id, spv.sale_price, spv.master_variant_id, mpv.cost_price,
               mpv.sku AS snapshot_sku, sp.title AS snapshot_name
        FROM cart_items ci JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
        JOIN store_products sp ON sp.id = spv.store_product_id
        JOIN master_product_variants mpv ON mpv.id = spv.master_variant_id
        WHERE ci.cart_id = v_checkout_cart_id
    ) LOOP
        v_item_gmv := v_cart_item.sale_price * v_cart_item.quantity;
        v_pub_unit_margin := ROUND(v_cart_item.sale_price * 0.15, 2);
        v_pub_item_margin := v_pub_unit_margin * v_cart_item.quantity;
        v_gross_item_margin := (v_cart_item.sale_price - v_cart_item.cost_price) * v_cart_item.quantity;
        v_merchant_item_margin := v_gross_item_margin - v_pub_item_margin;
        IF v_merchant_item_margin < 0 THEN RAISE EXCEPTION 'MERCHANT_MARGIN_NEGATIVE'; END IF;
        v_final_order_total := v_final_order_total + v_item_gmv;
    END LOOP;
    v_final_order_total := v_final_order_total + v_quote_price;

    -- STEP 7: Insert Order Header (PENDING_PAYMENT — unchanged)
    v_order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');
    INSERT INTO orders (organization_id, store_id, customer_id, checkout_id, order_number, status, currency, total_amount)
    VALUES (v_organization_id, v_checkout_store_id, v_final_customer_id, p_checkout_id, v_order_number, 'PENDING_PAYMENT', 'BRL', v_final_order_total)
    RETURNING id INTO v_new_order_id;

    -- STEP 8: Insert Order Items (same as 00016)
    FOR v_cart_item IN (
        SELECT ci.quantity, ci.store_product_variant_id, spv.sale_price, spv.master_variant_id,
               mpv.cost_price, mpv.sku AS snapshot_sku, sp.title AS snapshot_name
        FROM cart_items ci JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
        JOIN store_products sp ON sp.id = spv.store_product_id
        JOIN master_product_variants mpv ON mpv.id = spv.master_variant_id
        WHERE ci.cart_id = v_checkout_cart_id
    ) LOOP
        v_pub_unit_margin := ROUND(v_cart_item.sale_price * 0.15, 2);
        v_pub_item_margin := v_pub_unit_margin * v_cart_item.quantity;
        v_gross_item_margin := (v_cart_item.sale_price - v_cart_item.cost_price) * v_cart_item.quantity;
        v_merchant_item_margin := v_gross_item_margin - v_pub_item_margin;
        INSERT INTO order_items (order_id, master_variant_id, store_product_variant_id, snapshot_sku,
            snapshot_name, quantity, sale_price, cost_price, discount, pub_margin, merchant_margin)
        VALUES (v_new_order_id, v_cart_item.master_variant_id, v_cart_item.store_product_variant_id, v_cart_item.snapshot_sku,
            v_cart_item.snapshot_name, v_cart_item.quantity, v_cart_item.sale_price, v_cart_item.cost_price,
            0.00, v_pub_item_margin, v_merchant_item_margin);
    END LOOP;

    -- STEP 9: Shipping Line & Address (same as 00016)
    INSERT INTO order_shipping_lines (order_id, carrier, service_name, charged_shipping_cost, actual_shipping_cost, estimated_days)
    VALUES (v_new_order_id, v_quote_carrier, v_quote_service, v_quote_price, NULL, v_quote_days);
    INSERT INTO order_addresses (order_id, recipient_name, phone, postal_code, street, number,
        complement, neighborhood, city, state, country)
    VALUES (v_new_order_id, v_addr_recipient, v_addr_phone, v_addr_postal, v_addr_street, v_addr_number,
        COALESCE(NULLIF(TRIM(COALESCE(p_shipping_address->>'complement', '')), ''), ''), v_addr_neighborhood, v_addr_city, v_addr_state, COALESCE(NULLIF(TRIM(COALESCE(p_shipping_address->>'country', '')), ''), 'BR'));

    -- NOTE: STEP 10 (COMMITTED transition) REMOVED from complete_checkout.
    -- The inventory remains RESERVED (ACTIVE reservations) while order is PENDING_PAYMENT.
    -- COMMITTED is only applied by settle_payment_inventory() after settlement (see below).

    -- STEP 11: Finalize Checkout / Cart
    UPDATE checkouts SET status = 'COMPLETED', updated_at = NOW() WHERE id = p_checkout_id;
    UPDATE carts SET status = 'COMPLETED', updated_at = NOW() WHERE id = v_checkout_cart_id;

    RETURN v_new_order_id;
END;
$$;

-- 2. Atomic settlement RPC for inventory transition (RESERVED -> COMMITTED) after payment.
CREATE OR REPLACE FUNCTION public.settle_payment_inventory(
    p_payment_id uuid,
    p_order_id uuid DEFAULT NULL
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
    -- Lock order with deterministic order (prevent deadlocks)
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

    -- Get the checkout_id for this order to lock reservations
    SELECT checkout_id INTO v_checkout_id FROM public.orders WHERE id = p_order_id;

    -- Only transition inventory for PAID orders (settlement has occurred or is occurring)
    IF v_order.status != 'PAID' THEN
        RAISE EXCEPTION 'ORDER_NOT_PAID';
    END IF;

    -- Transition each ACTIVE reservation to COMMITTED only once (idempotent)
    FOR v_res IN (
        SELECT id, master_variant_id, quantity
        FROM inventory_reservations
        WHERE checkout_id = v_checkout_id
          AND status = 'ACTIVE'
        ORDER BY master_variant_id ASC
        FOR UPDATE
    ) LOOP
        -- Skip if already committed by previous call (idempotency)
        IF EXISTS (SELECT 1 FROM inventory_reservations WHERE id = v_res.id AND status = 'COMMITTED') THEN
            CONTINUE;
        END IF;

        UPDATE master_inventory
        SET reserved = reserved - v_res.quantity,
            committed = committed + v_res.quantity,
            updated_at = NOW()
        WHERE master_variant_id = v_res.master_variant_id;

        UPDATE inventory_reservations
        SET status = 'COMMITTED'
        WHERE id = v_res.id;

        INSERT INTO inventory_movements (master_variant_id, movement_type, quantity, reference_type, reference_id)
        VALUES (v_res.master_variant_id, 'COMMIT', v_res.quantity, 'ORDER_ITEM', v_order.id);
    END LOOP;

    RETURN true;
END;
$$;

-- 3. Atomic cancellation RPC for PENDING_PAYMENT orders (release RESERVED inventory)
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
    -- Lock order with deterministic order (prevent deadlocks)
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

    -- Only allow cancellation for PENDING_PAYMENT orders
    IF v_order.status != 'PENDING_PAYMENT' THEN
        RAISE EXCEPTION 'ORDER_NOT_PENDING_PAYMENT';
    END IF;

    -- Idempotency: if already CANCELLED, do nothing (success)
    IF v_order.status = 'CANCELLED' THEN
        RETURN true;
    END IF;

    -- Get the checkout_id for this order to lock reservations
    SELECT checkout_id INTO v_checkout_id FROM public.orders WHERE id = p_order_id;

    -- Release each ACTIVE reservation to RELEASED only once (idempotent)
    FOR v_res IN (
        SELECT id, master_variant_id, quantity
        FROM inventory_reservations
        WHERE checkout_id = v_checkout_id
          AND status = 'ACTIVE'
        ORDER BY master_variant_id ASC
        FOR UPDATE
    ) LOOP
        -- Skip if already released by previous call (idempotency)
        IF EXISTS (SELECT 1 FROM inventory_reservations WHERE id = v_res.id AND status = 'RELEASED') THEN
            CONTINUE;
        END IF;

        UPDATE master_inventory
        SET reserved = reserved - v_res.quantity,
            updated_at = NOW()
        WHERE master_variant_id = v_res.master_variant_id;

        UPDATE inventory_reservations
        SET status = 'RELEASED',
            released_at = NOW()
        WHERE id = v_res.id;

        INSERT INTO inventory_movements (master_variant_id, movement_type, quantity, reference_type, reference_id)
        VALUES (v_res.master_variant_id, 'RELEASE', v_res.quantity, 'ORDER_ITEM', v_order.id);
    END LOOP;

    -- Transition order to CANCELLED
    UPDATE public.orders
    SET status = 'CANCELLED',
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_payment_inventory FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment_inventory(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_pending_payment_order FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_payment_order(uuid) TO service_role;