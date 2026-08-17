-- Migration 00012: Corrective Cart Items Persistence Foundation

-- 1. Create cart_items table
CREATE TABLE cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    store_product_variant_id uuid NOT NULL REFERENCES store_product_variants(id) ON DELETE CASCADE,
    quantity integer NOT NULL CHECK (quantity > 0),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    UNIQUE(cart_id, store_product_variant_id)
);

-- 2. Indexes
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items(store_product_variant_id);

-- 3. Timestamp Update Trigger
CREATE TRIGGER set_timestamp_cart_items 
    BEFORE UPDATE ON cart_items 
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- 4. Cross-Store Integrity Trigger
-- Ensures a cart item's variant strictly belongs to the same store as the cart.
CREATE OR REPLACE FUNCTION check_cart_item_store_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart_store_id uuid;
    v_variant_store_id uuid;
BEGIN
    -- Derive cart store_id
    SELECT store_id INTO v_cart_store_id FROM carts WHERE id = NEW.cart_id;
    
    -- Derive variant store_id
    SELECT sp.store_id INTO v_variant_store_id 
    FROM store_product_variants spv 
    JOIN store_products sp ON sp.id = spv.store_product_id 
    WHERE spv.id = NEW.store_product_variant_id;
    
    -- Reject mismatches structurally
    IF v_cart_store_id != v_variant_store_id THEN
        RAISE EXCEPTION 'Cross-store cart item forbidden. Cart store % != Variant store %', v_cart_store_id, v_variant_store_id;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cart_items_store_integrity 
    BEFORE INSERT OR UPDATE OF cart_id, store_product_variant_id 
    ON cart_items 
    FOR EACH ROW EXECUTE PROCEDURE check_cart_item_store_integrity();


-- 5. Enable RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- 6. Define RLS Policies

-- A. Authenticated Customer Access (Mutation allowed for own cart)
CREATE POLICY "ci_auth_all" ON cart_items FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM carts c
        JOIN customers cu ON cu.id = c.customer_id
        WHERE c.id = cart_items.cart_id AND cu.user_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM carts c
        JOIN customers cu ON cu.id = c.customer_id
        WHERE c.id = cart_items.cart_id AND cu.user_id = auth.uid()
    )
);

-- B. Tenant Operator Access (Read-only allowed for their store's carts)
CREATE POLICY "ci_tenant_sel" ON cart_items FOR SELECT TO authenticated USING (
    has_org_role(
        (SELECT organization_id FROM stores WHERE id = (
            SELECT store_id FROM store_products WHERE id = (
                SELECT store_product_id FROM store_product_variants WHERE id = cart_items.store_product_variant_id
            )
        )), 
        'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR'
    )
);

-- Note: anon has NO policies at all. Default-deny blocks all access natively.
-- Guest carts will be manipulated exclusively through trusted backend APIs.

-- 7. Grants
-- Service_role implicit bypass allows backend API mutation for guests.
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO authenticated, service_role;
-- Anon gets absolutely nothing to ensure raw database security.
