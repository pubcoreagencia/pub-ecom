-- 00014_CHECKOUT_TRANSACTIONS: ATOMIC CHECKOUT CREATION AND EXPIRATION

-- ==========================================
-- 1. CREATE_CHECKOUT
-- ==========================================
CREATE OR REPLACE FUNCTION create_checkout(
    p_cart_id uuid,
    p_store_id uuid,
    p_customer_id uuid,
    p_guest_token_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_user_id uuid;
    v_customer_org_id uuid;
    v_store_org_id uuid;
    v_cart_status text;
    v_cart_customer_id uuid;
    v_cart_guest_hash text;
    v_cart_token_expires timestamptz;
    v_new_checkout_id uuid;
    v_item record;
BEGIN
    -- 1. Validate Store and Customer Organization
    SELECT organization_id INTO v_store_org_id FROM stores WHERE id = p_store_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'store_mismatch';
    END IF;

    IF p_customer_id IS NOT NULL THEN
        SELECT user_id, organization_id INTO v_customer_user_id, v_customer_org_id 
        FROM customers WHERE id = p_customer_id;
        
        IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized_cart'; END IF;
        IF v_customer_org_id != v_store_org_id THEN RAISE EXCEPTION 'store_mismatch'; END IF;
        
        -- Caller validation for authenticated users
        IF auth.uid() IS NOT NULL AND auth.uid() != v_customer_user_id THEN
            RAISE EXCEPTION 'unauthorized_cart';
        END IF;
    END IF;

    -- 2. Lock Cart
    SELECT status, customer_id, guest_token_hash, token_expires_at 
    INTO v_cart_status, v_cart_customer_id, v_cart_guest_hash, v_cart_token_expires
    FROM carts 
    WHERE id = p_cart_id AND store_id = p_store_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'cart_not_found'; END IF;

    -- 3. Check for Active Checkout (Uniqueness)
    IF EXISTS (SELECT 1 FROM checkouts WHERE cart_id = p_cart_id AND status = 'IN_PROGRESS') THEN
        RAISE EXCEPTION 'active_checkout_exists';
    END IF;

    IF v_cart_status != 'ACTIVE' THEN RAISE EXCEPTION 'cart_not_active'; END IF;

    -- 3. Validate Cart Ownership
    IF p_customer_id IS NOT NULL THEN
        IF v_cart_customer_id != p_customer_id THEN RAISE EXCEPTION 'unauthorized_cart'; END IF;
    ELSE
        IF v_cart_customer_id IS NOT NULL THEN RAISE EXCEPTION 'unauthorized_cart'; END IF;
        IF v_cart_guest_hash != p_guest_token_hash THEN RAISE EXCEPTION 'invalid_guest_token'; END IF;
        IF v_cart_token_expires < NOW() THEN RAISE EXCEPTION 'expired_guest_cart'; END IF;
    END IF;

    -- 4. Check for Active Checkout (Uniqueness)
    IF EXISTS (SELECT 1 FROM checkouts WHERE cart_id = p_cart_id AND status = 'IN_PROGRESS') THEN
        RAISE EXCEPTION 'active_checkout_exists';
    END IF;

    -- 5. Validate Cart Items exist
    IF NOT EXISTS (SELECT 1 FROM cart_items WHERE cart_id = p_cart_id) THEN
        RAISE EXCEPTION 'empty_cart';
    END IF;

    -- 6. Pre-flight Validation (Store Products & Variants Active/Published)
    -- If any item is invalid, raise exception
    IF EXISTS (
        SELECT 1 
        FROM cart_items ci
        JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
        JOIN store_products sp ON sp.id = spv.store_product_id
        WHERE ci.cart_id = p_cart_id 
        AND (sp.status != 'PUBLISHED' OR spv.is_active = false)
    ) THEN
        RAISE EXCEPTION 'unavailable_variant';
    END IF;

    -- 7. Insert Checkout
    INSERT INTO checkouts (cart_id, store_id, status)
    VALUES (p_cart_id, p_store_id, 'IN_PROGRESS')
    RETURNING id INTO v_new_checkout_id;

    -- 8. Lock and Update Inventory in Deterministic Order
    -- Group quantities by master_variant_id to handle duplicate underlying master variants safely
    FOR v_item IN (
        SELECT 
            spv.master_variant_id, 
            SUM(ci.quantity) as total_qty
        FROM cart_items ci
        JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
        WHERE ci.cart_id = p_cart_id
        GROUP BY spv.master_variant_id
        ORDER BY spv.master_variant_id ASC
    ) LOOP
        -- Attempt to update inventory. The CHECK constraint (available_logic) will raise an error if insufficient stock.
        UPDATE master_inventory 
        SET reserved = reserved + v_item.total_qty, updated_at = NOW()
        WHERE master_variant_id = v_item.master_variant_id
          AND (on_hand - reserved - committed) >= v_item.total_qty;

        -- If the update affected 0 rows, it means the WHERE clause failed (insufficient stock)
        IF NOT FOUND THEN
            RAISE EXCEPTION 'insufficient_stock';
        END IF;

        -- Insert Reservation
        INSERT INTO inventory_reservations (master_variant_id, checkout_id, quantity, status, expires_at)
        VALUES (v_item.master_variant_id, v_new_checkout_id, v_item.total_qty, 'ACTIVE', NOW() + INTERVAL '15 minutes');

        -- Insert Movement
        INSERT INTO inventory_movements (master_variant_id, movement_type, quantity, reference_type, reference_id)
        VALUES (v_item.master_variant_id, 'RESERVE', v_item.total_qty, 'CHECKOUT', v_new_checkout_id);
    END LOOP;

    -- 9. Transition Cart State
    UPDATE carts SET status = 'IN_PROGRESS' WHERE id = p_cart_id;

    RETURN v_new_checkout_id;
END;
$$;

-- Revoke/Grant Permissions
REVOKE EXECUTE ON FUNCTION create_checkout FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_checkout TO authenticated, service_role;


-- ==========================================
-- 2. EXPIRE_CHECKOUT
-- ==========================================
CREATE OR REPLACE FUNCTION expire_checkout(
    p_checkout_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_checkout_status text;
    v_cart_id uuid;
    v_item record;
BEGIN
    -- 1. Lock Checkout
    SELECT status, cart_id INTO v_checkout_status, v_cart_id 
    FROM checkouts 
    WHERE id = p_checkout_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'checkout_not_found';
    END IF;

    -- Only expire IN_PROGRESS checkouts
    IF v_checkout_status != 'IN_PROGRESS' THEN
        RETURN false;
    END IF;

    -- 2. Process ACTIVE reservations in deterministic order
    FOR v_item IN (
        SELECT id, master_variant_id, quantity
        FROM inventory_reservations
        WHERE checkout_id = p_checkout_id AND status = 'ACTIVE'
        ORDER BY master_variant_id ASC
        FOR UPDATE
    ) LOOP
        -- Decrement Reserved Stock
        UPDATE master_inventory 
        SET reserved = reserved - v_item.quantity, updated_at = NOW()
        WHERE master_variant_id = v_item.master_variant_id;

        -- Mark Reservation as RELEASED
        UPDATE inventory_reservations 
        SET status = 'RELEASED', released_at = NOW()
        WHERE id = v_item.id;

        -- Insert Movement
        INSERT INTO inventory_movements (master_variant_id, movement_type, quantity, reference_type, reference_id)
        VALUES (v_item.master_variant_id, 'RELEASE', v_item.quantity, 'CHECKOUT', p_checkout_id);
    END LOOP;

    -- 3. Update Checkout Status
    UPDATE checkouts SET status = 'EXPIRED', updated_at = NOW() WHERE id = p_checkout_id;

    -- 4. Restore Cart to ACTIVE
    UPDATE carts SET status = 'ACTIVE', updated_at = NOW() WHERE id = v_cart_id;

    RETURN true;
END;
$$;

-- Strictly isolated to service_role to prevent griefing
REVOKE EXECUTE ON FUNCTION expire_checkout FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION expire_checkout FROM authenticated;
GRANT EXECUTE ON FUNCTION expire_checkout TO service_role;
