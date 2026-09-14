-- 00016_ORDER_EXECUTION: ATOMIC CHECKOUT COMPLETION & ORDER PERSISTENCE

-- ==========================================
-- 1. CONSTRAINTS & SEQUENCES
-- ==========================================

-- Ensure strictly 1 checkout -> max 1 order at the schema level
ALTER TABLE orders ADD CONSTRAINT uq_orders_checkout_id UNIQUE (checkout_id);

-- Concurrency-safe sequence for order_number generation
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 100001;

-- ==========================================
-- 2. COMPLETE_CHECKOUT RPC
-- ==========================================

CREATE OR REPLACE FUNCTION complete_checkout(
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
    -- Checkout & Cart records
    v_checkout_status text;
    v_checkout_cart_id uuid;
    v_checkout_store_id uuid;
    v_cart_status text;
    v_cart_customer_id uuid;
    v_cart_store_id uuid;
    v_cart_guest_hash text;

    -- Organization & Store
    v_organization_id uuid;

    -- Customer resolution
    v_final_customer_id uuid;
    v_guest_email text;
    v_guest_name text;
    v_guest_document text;

    -- Shipping quote
    v_quote_carrier text;
    v_quote_service text;
    v_quote_price numeric(15,2);
    v_quote_days integer;

    -- Shipping address fields
    v_addr_recipient text;
    v_addr_phone text;
    v_addr_postal text;
    v_addr_street text;
    v_addr_number text;
    v_addr_complement text;
    v_addr_neighborhood text;
    v_addr_city text;
    v_addr_state text;
    v_addr_country text;

    -- Order totals and items
    v_new_order_id uuid;
    v_existing_order_id uuid;
    v_order_number text;
    v_total_product_gmv numeric(15,2) := 0.00;
    v_final_order_total numeric(15,2) := 0.00;

    -- Cursor and loop records
    v_cart_item record;
    v_res record;
    v_cart_item_count integer := 0;
    v_reservation_count integer := 0;

    -- Economic variables per item
    v_item_gmv numeric(15,2);
    v_pub_unit_margin numeric(15,2);
    v_pub_item_margin numeric(15,2);
    v_gross_item_margin numeric(15,2);
    v_merchant_item_margin numeric(15,2);
    v_new_order_item_id uuid;
BEGIN
    -- ----------------------------------------------------
    -- STEP 1: Lock and Inspect Checkout
    -- ----------------------------------------------------
    SELECT status, cart_id, store_id
    INTO v_checkout_status, v_checkout_cart_id, v_checkout_store_id
    FROM checkouts
    WHERE id = p_checkout_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'checkout_not_found';
    END IF;

    -- Idempotency Check
    IF v_checkout_status = 'COMPLETED' THEN
        SELECT id INTO v_existing_order_id FROM orders WHERE checkout_id = p_checkout_id;
        IF v_existing_order_id IS NOT NULL THEN
            RETURN v_existing_order_id;
        ELSE
            RAISE EXCEPTION 'invariant_violation_completed_checkout_without_order';
        END IF;
    END IF;

    IF v_checkout_status = 'EXPIRED' THEN
        RAISE EXCEPTION 'checkout_expired';
    END IF;

    IF v_checkout_status != 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'checkout_not_in_progress';
    END IF;

    -- ----------------------------------------------------
    -- STEP 2: Lock and Inspect Cart
    -- ----------------------------------------------------
    SELECT status, customer_id, store_id, guest_token_hash
    INTO v_cart_status, v_cart_customer_id, v_cart_store_id, v_cart_guest_hash
    FROM carts
    WHERE id = v_checkout_cart_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'cart_not_found';
    END IF;

    IF v_cart_store_id != v_checkout_store_id THEN
        RAISE EXCEPTION 'store_mismatch';
    END IF;

    -- Resolve Store Organization
    SELECT organization_id INTO v_organization_id
    FROM stores
    WHERE id = v_checkout_store_id AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_store';
    END IF;

    -- ----------------------------------------------------
    -- STEP 3: Customer Resolution (Registered vs Guest)
    -- ----------------------------------------------------
    IF v_cart_customer_id IS NOT NULL THEN
        -- Registered customer on cart: verify org match
        PERFORM 1 FROM customers WHERE id = v_cart_customer_id AND organization_id = v_organization_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'unauthorized_customer';
        END IF;
        v_final_customer_id := v_cart_customer_id;
    ELSE
        -- Guest customer: MUST provide email, full_name, document
        IF p_customer_info IS NULL THEN
            RAISE EXCEPTION 'missing_customer_info';
        END IF;

        v_guest_email := TRIM(COALESCE(p_customer_info->>'email', ''));
        v_guest_name := TRIM(COALESCE(p_customer_info->>'full_name', ''));
        v_guest_document := TRIM(COALESCE(p_customer_info->>'document', ''));

        IF v_guest_email = '' THEN
            RAISE EXCEPTION 'missing_guest_email';
        END IF;
        IF v_guest_name = '' THEN
            RAISE EXCEPTION 'missing_guest_name';
        END IF;
        IF v_guest_document = '' THEN
            RAISE EXCEPTION 'missing_guest_document';
        END IF;

        -- Create guest customer profile in organization
        INSERT INTO customers (organization_id, user_id, email, full_name, document)
        VALUES (v_organization_id, NULL, v_guest_email, v_guest_name, v_guest_document)
        RETURNING id INTO v_final_customer_id;
    END IF;

    -- ----------------------------------------------------
    -- STEP 4: Validate Shipping Quote & Address
    -- ----------------------------------------------------
    IF p_shipping_quote_id IS NULL THEN
        RAISE EXCEPTION 'missing_shipping_quote';
    END IF;

    SELECT carrier, service_name, price, estimated_days
    INTO v_quote_carrier, v_quote_service, v_quote_price, v_quote_days
    FROM shipping_quotes
    WHERE id = p_shipping_quote_id AND checkout_id = p_checkout_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_shipping_quote';
    END IF;

    IF p_shipping_address IS NULL THEN
        RAISE EXCEPTION 'missing_shipping_address';
    END IF;

    v_addr_recipient := TRIM(COALESCE(p_shipping_address->>'recipient_name', ''));
    v_addr_postal := TRIM(COALESCE(p_shipping_address->>'postal_code', ''));
    v_addr_street := TRIM(COALESCE(p_shipping_address->>'street', ''));
    v_addr_number := TRIM(COALESCE(p_shipping_address->>'number', ''));
    v_addr_city := TRIM(COALESCE(p_shipping_address->>'city', ''));
    v_addr_state := TRIM(COALESCE(p_shipping_address->>'state', ''));
    v_addr_phone := TRIM(COALESCE(p_shipping_address->>'phone', ''));
    v_addr_complement := TRIM(COALESCE(p_shipping_address->>'complement', ''));
    v_addr_neighborhood := TRIM(COALESCE(p_shipping_address->>'neighborhood', ''));
    v_addr_country := COALESCE(NULLIF(TRIM(p_shipping_address->>'country'), ''), 'BR');

    IF v_addr_recipient = '' OR v_addr_postal = '' OR v_addr_street = '' OR v_addr_number = '' OR v_addr_city = '' OR v_addr_state = '' THEN
        RAISE EXCEPTION 'invalid_shipping_address';
    END IF;

    -- ----------------------------------------------------
    -- STEP 5: Validate Reservations Integrity vs Cart Items
    -- ----------------------------------------------------
    -- Check that cart has items
    SELECT COUNT(*) INTO v_cart_item_count FROM cart_items WHERE cart_id = v_checkout_cart_id;
    IF v_cart_item_count = 0 THEN
        RAISE EXCEPTION 'empty_cart';
    END IF;

    -- Lock all active reservations for this checkout
    PERFORM id FROM inventory_reservations
    WHERE checkout_id = p_checkout_id AND status = 'ACTIVE'
    FOR UPDATE;

    -- Verify every reservation matches expected cart totals per master variant
    FOR v_res IN (
        SELECT
            spv.master_variant_id,
            SUM(ci.quantity) AS expected_qty
        FROM cart_items ci
        JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
        WHERE ci.cart_id = v_checkout_cart_id
        GROUP BY spv.master_variant_id
        ORDER BY spv.master_variant_id ASC
    ) LOOP
        DECLARE
            v_actual_res_qty integer;
        BEGIN
            SELECT COALESCE(SUM(quantity), 0) INTO v_actual_res_qty
            FROM inventory_reservations
            WHERE checkout_id = p_checkout_id
              AND master_variant_id = v_res.master_variant_id
              AND status = 'ACTIVE';

            IF v_actual_res_qty != v_res.expected_qty THEN
                RAISE EXCEPTION 'reservation_mismatch';
            END IF;
        END;
    END LOOP;

    -- ----------------------------------------------------
    -- STEP 6: Pre-calculate Order Totals & Validate Margin
    -- ----------------------------------------------------
    FOR v_cart_item IN (
        SELECT
            ci.id as cart_item_id,
            ci.quantity,
            ci.store_product_variant_id,
            spv.sale_price,
            spv.master_variant_id,
            mpv.cost_price,
            mpv.sku as snapshot_sku,
            sp.title as snapshot_name
        FROM cart_items ci
        JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
        JOIN store_products sp ON sp.id = spv.store_product_id
        JOIN master_product_variants mpv ON mpv.id = spv.master_variant_id
        WHERE ci.cart_id = v_checkout_cart_id
    ) LOOP
        v_item_gmv := v_cart_item.sale_price * v_cart_item.quantity;
        v_pub_unit_margin := ROUND(v_cart_item.sale_price * 0.15, 2);
        v_pub_item_margin := v_pub_unit_margin * v_cart_item.quantity;
        v_gross_item_margin := (v_cart_item.sale_price - v_cart_item.cost_price) * v_cart_item.quantity;
        v_merchant_item_margin := v_gross_item_margin - v_pub_item_margin;

        -- Negative margin gatekeeper
        IF v_merchant_item_margin < 0 THEN
            RAISE EXCEPTION 'MERCHANT_MARGIN_NEGATIVE';
        END IF;

        v_total_product_gmv := v_total_product_gmv + v_item_gmv;
    END LOOP;

    v_final_order_total := v_total_product_gmv + v_quote_price;

    -- ----------------------------------------------------
    -- STEP 7: Insert Order Header
    -- ----------------------------------------------------
    v_order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');

    INSERT INTO orders (
        organization_id,
        store_id,
        customer_id,
        checkout_id,
        order_number,
        status,
        currency,
        total_amount
    )
    VALUES (
        v_organization_id,
        v_checkout_store_id,
        v_final_customer_id,
        p_checkout_id,
        v_order_number,
        'PENDING_PAYMENT',
        'BRL',
        v_final_order_total
    )
    RETURNING id INTO v_new_order_id;

    -- ----------------------------------------------------
    -- STEP 8: Insert Order Items with Economic Snapshots
    -- ----------------------------------------------------
    FOR v_cart_item IN (
        SELECT
            ci.quantity,
            ci.store_product_variant_id,
            spv.sale_price,
            spv.master_variant_id,
            mpv.cost_price,
            mpv.sku as snapshot_sku,
            sp.title as snapshot_name
        FROM cart_items ci
        JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
        JOIN store_products sp ON sp.id = spv.store_product_id
        JOIN master_product_variants mpv ON mpv.id = spv.master_variant_id
        WHERE ci.cart_id = v_checkout_cart_id
    ) LOOP
        v_pub_unit_margin := ROUND(v_cart_item.sale_price * 0.15, 2);
        v_pub_item_margin := v_pub_unit_margin * v_cart_item.quantity;
        v_gross_item_margin := (v_cart_item.sale_price - v_cart_item.cost_price) * v_cart_item.quantity;
        v_merchant_item_margin := v_gross_item_margin - v_pub_item_margin;

        INSERT INTO order_items (
            order_id,
            master_variant_id,
            store_product_variant_id,
            snapshot_sku,
            snapshot_name,
            quantity,
            sale_price,
            cost_price,
            discount,
            pub_margin,
            merchant_margin
        )
        VALUES (
            v_new_order_id,
            v_cart_item.master_variant_id,
            v_cart_item.store_product_variant_id,
            v_cart_item.snapshot_sku,
            v_cart_item.snapshot_name,
            v_cart_item.quantity,
            v_cart_item.sale_price,
            v_cart_item.cost_price,
            0.00,
            v_pub_item_margin,
            v_merchant_item_margin
        );
    END LOOP;

    -- ----------------------------------------------------
    -- STEP 9: Insert Shipping Line and Address Snapshots
    -- ----------------------------------------------------
    INSERT INTO order_shipping_lines (
        order_id,
        carrier,
        service_name,
        charged_shipping_cost,
        actual_shipping_cost,
        estimated_days
    )
    VALUES (
        v_new_order_id,
        v_quote_carrier,
        v_quote_service,
        v_quote_price,
        NULL,
        v_quote_days
    );

    INSERT INTO order_addresses (
        order_id,
        recipient_name,
        phone,
        postal_code,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        country
    )
    VALUES (
        v_new_order_id,
        v_addr_recipient,
        v_addr_phone,
        v_addr_postal,
        v_addr_street,
        v_addr_number,
        v_addr_complement,
        v_addr_neighborhood,
        v_addr_city,
        v_addr_state,
        v_addr_country
    );

    -- ----------------------------------------------------
    -- STEP 10: Commit Inventory (RESERVED -> COMMITTED)
    -- ----------------------------------------------------
    -- Deterministic order of master_variant_id to prevent deadlocks
    FOR v_res IN (
        SELECT id, master_variant_id, quantity
        FROM inventory_reservations
        WHERE checkout_id = p_checkout_id AND status = 'ACTIVE'
        ORDER BY master_variant_id ASC
        FOR UPDATE
    ) LOOP
        -- Adjust inventory counts
        UPDATE master_inventory
        SET reserved = reserved - v_res.quantity,
            committed = committed + v_res.quantity,
            updated_at = NOW()
        WHERE master_variant_id = v_res.master_variant_id;

        -- Update reservation status
        UPDATE inventory_reservations
        SET status = 'COMMITTED'
        WHERE id = v_res.id;

        -- Log movement
        INSERT INTO inventory_movements (
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
            v_new_order_id
        );
    END LOOP;

    -- ----------------------------------------------------
    -- STEP 11: Finalize Checkout and Cart States
    -- ----------------------------------------------------
    UPDATE checkouts
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE id = p_checkout_id;

    UPDATE carts
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE id = v_checkout_cart_id;

    -- Return the created order id
    RETURN v_new_order_id;
END;
$$;

-- Revoke execution from public, anon, authenticated; strictly limit to service_role
REVOKE EXECUTE ON FUNCTION complete_checkout(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_checkout(uuid, uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION complete_checkout(uuid, uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION complete_checkout(uuid, uuid, jsonb, jsonb) TO service_role;
