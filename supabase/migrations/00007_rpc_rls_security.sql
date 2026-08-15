-- 00007_RPC_RLS_SECURITY

-- 1. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_shipping_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÕES AUXILIARES SEGURAS DE RBAC E IDENTIDADE
CREATE OR REPLACE FUNCTION has_org_role(p_organization_id uuid, VARIADIC p_roles text[])
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND role = ANY(p_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. POLICIES (DENY BY DEFAULT - APENAS EXCEÇÕES ALLOW DECLARADAS)

-- Memberships
CREATE POLICY "m_sel_own_or_admin" ON memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_org_role(organization_id, 'OWNER', 'ADMIN'));

-- Organizações
CREATE POLICY "org_sel_member" ON organizations FOR SELECT TO authenticated USING (has_org_role(id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR'));

-- Lojas
CREATE POLICY "store_sel_member" ON stores FOR SELECT TO authenticated USING (has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR'));

-- Store Domains
CREATE POLICY "domain_sel_pub" ON store_domains FOR SELECT TO PUBLIC USING (true);

-- Catalog (Public Read)
CREATE POLICY "sp_sel_pub" ON store_products FOR SELECT TO PUBLIC USING (status = 'PUBLISHED' AND deleted_at IS NULL);
CREATE POLICY "spv_sel_pub" ON store_product_variants FOR SELECT TO PUBLIC USING (is_active = true);

-- Customers
-- Cliente lê o seu. Lojista lê da org caso tenha permissão administrativa ou operacional
CREATE POLICY "cust_sel_auth" ON customers FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_org_role(organization_id, 'OWNER', 'ADMIN', 'OPERATOR'));
CREATE POLICY "cust_upd_auth" ON customers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Carts
CREATE POLICY "cart_sel_own" ON carts FOR SELECT TO authenticated USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "cart_ins_own" ON carts FOR INSERT TO authenticated WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "cart_upd_own" ON carts FOR UPDATE TO authenticated USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())) WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "cart_del_own" ON carts FOR DELETE TO authenticated USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- Checkouts
CREATE POLICY "chk_sel_own" ON checkouts FOR SELECT TO authenticated USING (cart_id IN (SELECT id FROM carts WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())));
CREATE POLICY "chk_ins_own" ON checkouts FOR INSERT TO authenticated WITH CHECK (cart_id IN (SELECT id FROM carts WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())));
CREATE POLICY "chk_upd_own" ON checkouts FOR UPDATE TO authenticated USING (cart_id IN (SELECT id FROM carts WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()))) WITH CHECK (cart_id IN (SELECT id FROM carts WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())));

-- Inventory Reservations
CREATE POLICY "inv_res_sel" ON inventory_reservations FOR SELECT TO authenticated USING (checkout_id IN (SELECT id FROM checkouts WHERE cart_id IN (SELECT id FROM carts WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()))));

-- Orders
CREATE POLICY "ord_sel_auth" ON orders FOR SELECT TO authenticated USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR'));

-- Order Items / Addresses / Fulfillments / Shipments
CREATE POLICY "oi_sel_ord" ON order_items FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')));
CREATE POLICY "oa_sel_ord" ON order_addresses FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')));
CREATE POLICY "osl_sel_ord" ON order_shipping_lines FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')));
CREATE POLICY "ful_sel_ord" ON fulfillments FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')));
CREATE POLICY "shp_sel_ord" ON shipments FOR SELECT TO authenticated USING (fulfillment_id IN (SELECT id FROM fulfillments WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR'))));

-- Payments (Customer and Roles)
CREATE POLICY "pay_sel_ord" ON payments FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')));

-- Merchant / Ledger
CREATE POLICY "ma_sel_merch" ON merchant_accounts FOR SELECT TO authenticated USING (has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE'));
CREATE POLICY "mle_sel_merch" ON merchant_ledger_entries FOR SELECT TO authenticated USING (merchant_account_id IN (SELECT id FROM merchant_accounts WHERE has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE')));

-- Shipping Profiles / Quotes
CREATE POLICY "spr_sel_merch" ON shipping_profiles FOR SELECT TO authenticated USING (has_org_role(organization_id, 'OWNER', 'ADMIN', 'OPERATOR'));
CREATE POLICY "sq_sel_own" ON shipping_quotes FOR SELECT TO authenticated USING (checkout_id IN (SELECT id FROM checkouts WHERE cart_id IN (SELECT id FROM carts WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()))));
CREATE POLICY "sq_ins_own" ON shipping_quotes FOR INSERT TO authenticated WITH CHECK (checkout_id IN (SELECT id FROM checkouts WHERE cart_id IN (SELECT id FROM carts WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()))));

-- 4. ÍNDICES DE PERFORMANCE RLS
CREATE INDEX idx_memberships_rbac ON memberships(user_id, organization_id, role);
CREATE INDEX idx_stores_org_id ON stores(organization_id);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_carts_customer_id ON carts(customer_id);
CREATE INDEX idx_checkouts_cart_id ON checkouts(cart_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_org_id ON orders(organization_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_merchant_accounts_org_id ON merchant_accounts(organization_id);
CREATE INDEX idx_merchant_ledger_merch_id ON merchant_ledger_entries(merchant_account_id);

-- 5. RPCS
-- ==========================================
-- RPC ATÔMICA PÚBLICA (CLIENT CALL)
-- ==========================================
CREATE OR REPLACE FUNCTION reserve_stock_atomic(
    p_master_variant_id uuid,
    p_checkout_id uuid,
    p_quantity integer,
    p_ttl_minutes integer DEFAULT 15
) RETURNS boolean AS $$
DECLARE
    v_updated_id uuid;
    v_store_id uuid;
    v_checkout_store_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado';
    END IF;

    SELECT store_id INTO v_checkout_store_id FROM checkouts WHERE id = p_checkout_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Checkout não encontrado'; END IF;

    SELECT sp.store_id INTO v_store_id
    FROM store_product_variants spv
    JOIN store_products sp ON sp.id = spv.store_product_id
    WHERE spv.master_variant_id = p_master_variant_id;
    
    IF v_store_id IS NULL OR v_store_id != v_checkout_store_id THEN
        RAISE EXCEPTION 'Variante não pertence à loja (Tenant Integrity)';
    END IF;

    PERFORM 1 FROM checkouts ch
    JOIN carts c ON c.id = ch.cart_id
    JOIN customers cu ON cu.id = c.customer_id
    WHERE ch.id = p_checkout_id AND cu.user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Acesso negado: O carrinho não pertence ao usuário autenticado.';
    END IF;

    UPDATE master_inventory
    SET reserved = reserved + p_quantity, updated_at = NOW()
    WHERE master_variant_id = p_master_variant_id 
      AND (on_hand - reserved - committed) >= p_quantity
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NOT NULL THEN
        INSERT INTO inventory_reservations (master_variant_id, checkout_id, quantity, expires_at)
        VALUES (p_master_variant_id, p_checkout_id, p_quantity, NOW() + (p_ttl_minutes || ' minutes')::interval);
        
        INSERT INTO inventory_movements (master_variant_id, movement_type, quantity, reference_type, reference_id)
        VALUES (p_master_variant_id, 'RESERVE', p_quantity, 'CHECKOUT', p_checkout_id);
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION reserve_stock_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_stock_atomic TO authenticated;


-- ==========================================
-- RPC ATÔMICA INTERNA (SERVICE ROLE CALL)
-- ==========================================
CREATE OR REPLACE FUNCTION service_reserve_stock_atomic(
    p_master_variant_id uuid,
    p_checkout_id uuid,
    p_quantity integer,
    p_ttl_minutes integer DEFAULT 15
) RETURNS boolean AS $$
DECLARE
    v_updated_id uuid;
    v_store_id uuid;
    v_checkout_store_id uuid;
BEGIN
    SELECT store_id INTO v_checkout_store_id FROM checkouts WHERE id = p_checkout_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Checkout não encontrado'; END IF;

    SELECT sp.store_id INTO v_store_id
    FROM store_product_variants spv
    JOIN store_products sp ON sp.id = spv.store_product_id
    WHERE spv.master_variant_id = p_master_variant_id;
    
    IF v_store_id IS NULL OR v_store_id != v_checkout_store_id THEN
        RAISE EXCEPTION 'Variante não pertence à loja (Tenant Integrity)';
    END IF;

    UPDATE master_inventory
    SET reserved = reserved + p_quantity, updated_at = NOW()
    WHERE master_variant_id = p_master_variant_id 
      AND (on_hand - reserved - committed) >= p_quantity
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NOT NULL THEN
        INSERT INTO inventory_reservations (master_variant_id, checkout_id, quantity, expires_at)
        VALUES (p_master_variant_id, p_checkout_id, p_quantity, NOW() + (p_ttl_minutes || ' minutes')::interval);
        
        INSERT INTO inventory_movements (master_variant_id, movement_type, quantity, reference_type, reference_id)
        VALUES (p_master_variant_id, 'RESERVE', p_quantity, 'CHECKOUT', p_checkout_id);
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION service_reserve_stock_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_reserve_stock_atomic TO service_role;

-- 6. GRANTS DE TABELA
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
