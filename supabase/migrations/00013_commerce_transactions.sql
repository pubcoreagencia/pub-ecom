-- 00013_COMMERCE_TRANSACTIONS: ATOMIC CART MERGE

CREATE OR REPLACE FUNCTION merge_guest_cart(
    p_guest_cart_id uuid,
    p_guest_token_hash text,
    p_customer_id uuid,
    p_store_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_org uuid;
    v_store_org uuid;
    v_customer_cart_id uuid;
    v_guest_status text;
    v_guest_store_id uuid;
    v_guest_token_expires timestamptz;
    v_guest_db_hash text;
    v_guest_customer_id uuid;
    v_item record;
    v_first_cart_id uuid;
    v_second_cart_id uuid;
BEGIN
    -- 1. Validate Customer & Store Organization match
    SELECT organization_id INTO v_customer_org FROM customers WHERE id = p_customer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_customer';
    END IF;

    SELECT organization_id INTO v_store_org FROM stores WHERE id = p_store_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_store';
    END IF;

    IF v_customer_org != v_store_org THEN
        RAISE EXCEPTION 'unauthorized_customer';
    END IF;

    -- 2. Establish targets & deterministic locking
    SELECT id INTO v_customer_cart_id 
    FROM carts 
    WHERE customer_id = p_customer_id 
      AND store_id = p_store_id 
      AND status = 'ACTIVE' 
    LIMIT 1;
    
    -- Lock ordering: lowest UUID first to prevent deadlocks
    IF v_customer_cart_id IS NOT NULL THEN
        IF p_guest_cart_id < v_customer_cart_id THEN
            v_first_cart_id := p_guest_cart_id;
            v_second_cart_id := v_customer_cart_id;
        ELSE
            v_first_cart_id := v_customer_cart_id;
            v_second_cart_id := p_guest_cart_id;
        END IF;
        
        PERFORM id FROM carts WHERE id = v_first_cart_id FOR UPDATE;
        PERFORM id FROM carts WHERE id = v_second_cart_id FOR UPDATE;
    ELSE
        PERFORM id FROM carts WHERE id = p_guest_cart_id FOR UPDATE;
    END IF;

    -- 3. Validate Guest Cart
    SELECT store_id, status, guest_token_hash, token_expires_at, customer_id
    INTO v_guest_store_id, v_guest_status, v_guest_db_hash, v_guest_token_expires, v_guest_customer_id
    FROM carts
    WHERE id = p_guest_cart_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_cart_state';
    END IF;
    
    IF v_guest_customer_id IS NOT NULL THEN
        RAISE EXCEPTION 'guest_cart_consumed';
    END IF;
    
    IF v_guest_store_id != p_store_id THEN
        RAISE EXCEPTION 'store_mismatch';
    END IF;

    IF v_guest_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'invalid_cart_state';
    END IF;

    IF v_guest_db_hash IS NULL OR v_guest_db_hash != p_guest_token_hash THEN
        RAISE EXCEPTION 'invalid_guest_token';
    END IF;

    IF v_guest_token_expires IS NULL OR v_guest_token_expires < NOW() THEN
        RAISE EXCEPTION 'expired_guest_cart';
    END IF;

    -- 4. Execute Merge Rules
    IF v_customer_cart_id IS NULL THEN
        -- Attach guest cart directly
        UPDATE carts
        SET customer_id = p_customer_id,
            guest_token_hash = NULL,
            token_expires_at = NULL,
            updated_at = NOW()
        WHERE id = p_guest_cart_id;
        
        -- Deterministically remove any unavailable variants
        DELETE FROM cart_items
        WHERE cart_id = p_guest_cart_id
          AND store_product_variant_id NOT IN (
              SELECT spv.id FROM store_product_variants spv
              JOIN store_products sp ON sp.id = spv.store_product_id
              WHERE spv.is_active = true AND sp.status = 'PUBLISHED'
          );

        RETURN p_guest_cart_id;
    ELSE
        -- Merge valid items into existing customer cart
        FOR v_item IN (
            SELECT ci.store_product_variant_id, ci.quantity
            FROM cart_items ci
            JOIN store_product_variants spv ON spv.id = ci.store_product_variant_id
            JOIN store_products sp ON sp.id = spv.store_product_id
            WHERE ci.cart_id = p_guest_cart_id
              AND spv.is_active = true
              AND sp.status = 'PUBLISHED'
        ) LOOP
            INSERT INTO cart_items (cart_id, store_product_variant_id, quantity)
            VALUES (v_customer_cart_id, v_item.store_product_variant_id, v_item.quantity)
            ON CONFLICT (cart_id, store_product_variant_id)
            DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity;
        END LOOP;
        
        -- Consume guest cart securely
        DELETE FROM carts WHERE id = p_guest_cart_id;
        
        -- Update target cart timestamp
        UPDATE carts SET updated_at = NOW() WHERE id = v_customer_cart_id;
        
        RETURN v_customer_cart_id;
    END IF;
END;
$$;

-- Secure the function execution boundary
REVOKE EXECUTE ON FUNCTION merge_guest_cart(uuid, text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION merge_guest_cart(uuid, text, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION merge_guest_cart(uuid, text, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION merge_guest_cart(uuid, text, uuid, uuid) TO service_role;
