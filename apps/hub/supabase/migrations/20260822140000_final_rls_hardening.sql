-- ==============================================================================
-- MIGRATION: 20260822140000_final_rls_hardening.sql
-- DESCRIPTION: Definitive PostgreSQL RLS & Schema Hardening across all 11 Business Tables
-- TARGETS:
--   1. profiles: User self-management, MASTER global via is_master()
--   2. stores: Owner isolation, public active store read
--   3. suppliers: Base table restricted to MASTER and owning supplier. Commercial view for authenticated catalogue
--   4. master_products: Base table (with supplier_cost) restricted to MASTER & supplier owner. Commercial view sanitized
--   5. products: Base table (with cost, profit_margin) restricted to MASTER & store owner. Public storefront view
--   6. customers: Multi-tenant store owner isolation, prevent cross-tenant insertion
--   7. marketing_events: Multi-tenant store owner isolation, pixel tracking with customer-store consistency check
--   8. orders: Base table (with cost, net_profit) restricted to store owner & MASTER
--   9. influencer_orders (View): User-level restriction for influencer_id/affiliate_id = auth.uid() or MASTER
--   10. commissions: Restricted to beneficiary profile_id = auth.uid() and MASTER
--   11. wallets & wallet_transactions: Restricted to owner profile_id = auth.uid() and MASTER
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR SECURITY CHECKS (SECURITY DEFINER to prevent policy recursion)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'MASTER'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_customer_store_match(p_customer_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = p_customer_id AND store_id = p_store_id
  );
$$;


-- ------------------------------------------------------------------------------
-- 1. PROFILES & ROLE ESCALATION PREVENTION
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Master users have full profile access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles base access policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;

-- 1.1 Trigger: Strictly prevent non-MASTER users from changing role
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_master() THEN
      RAISE EXCEPTION 'Forbidden: Only MASTER administrators can change user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.profiles;
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- 1.2 Trigger: Enforce default non-privileged role on insert by non-masters
CREATE OR REPLACE FUNCTION public.enforce_profile_insert_role()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_master() THEN
    NEW.role := 'LOJISTA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_profile_insert_role_trigger ON public.profiles;
DROP TRIGGER IF EXISTS trg_enforce_profile_insert_role ON public.profiles;
CREATE TRIGGER trg_enforce_profile_insert_role
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_insert_role();

DROP TRIGGER IF EXISTS trg_enforce_profile_insert_role ON public.profiles;
CREATE TRIGGER trg_enforce_profile_insert_role
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_insert_role();

-- 1.3 Policies for Profiles
CREATE POLICY "Profiles select policy"
ON public.profiles FOR SELECT TO authenticated
USING (
    id = auth.uid() 
    OR public.is_master()
);

CREATE POLICY "Profiles insert policy"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
    id = auth.uid()
    OR public.is_master()
);

CREATE POLICY "Profiles update policy"
ON public.profiles FOR UPDATE TO authenticated
USING (
    id = auth.uid() 
    OR public.is_master()
)
WITH CHECK (
    (id = auth.uid() AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR public.is_master()))
    OR public.is_master()
);


-- ------------------------------------------------------------------------------
-- 2. STORES
-- ------------------------------------------------------------------------------
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;
DROP POLICY IF EXISTS "Store owners can manage their stores" ON public.stores;
DROP POLICY IF EXISTS "Stores base policy" ON public.stores;
DROP POLICY IF EXISTS "Stores select policy" ON public.stores;
DROP POLICY IF EXISTS "Stores modify policy" ON public.stores;

CREATE POLICY "Stores select policy"
ON public.stores FOR SELECT TO anon, authenticated
USING (
    status = 'active'
    OR owner_id = auth.uid()
    OR public.is_master()
);

CREATE POLICY "Stores modify policy"
ON public.stores FOR ALL TO authenticated
USING (
    owner_id = auth.uid()
    OR public.is_master()
)
WITH CHECK (
    owner_id = auth.uid()
    OR public.is_master()
);


-- ------------------------------------------------------------------------------
-- 3. SUPPLIERS & COMMERCIAL VIEW
-- ------------------------------------------------------------------------------
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authorized users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Master and suppliers can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table select policy" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table insert policy" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table update policy" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table delete policy" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table access policy" ON public.suppliers;

CREATE POLICY "Suppliers base table access policy"
ON public.suppliers FOR ALL TO authenticated
USING (
    public.is_master()
    OR (profile_id IS NOT NULL AND profile_id = auth.uid())
)
WITH CHECK (
    public.is_master()
    OR (profile_id IS NOT NULL AND profile_id = auth.uid())
);

-- Commercial view: restricted to authenticated users, only exposing suppliers with active products
DROP VIEW IF EXISTS public.public_suppliers CASCADE;
CREATE OR REPLACE VIEW public.public_suppliers WITH (security_invoker = false) AS
SELECT DISTINCT
    s.id,
    s.name,
    s.category,
    s.created_at
FROM public.suppliers s
JOIN public.master_products mp ON mp.supplier_id = s.id
WHERE mp.is_available = true AND mp.status = 'active';

REVOKE ALL ON public.public_suppliers FROM anon, public;
GRANT SELECT ON public.public_suppliers TO authenticated;


-- ------------------------------------------------------------------------------
-- 4. MASTER PRODUCTS & COMMERCIAL VIEW
-- ------------------------------------------------------------------------------
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master products are viewable by all authenticated users" ON public.master_products;
DROP POLICY IF EXISTS "Master and suppliers can view full master products" ON public.master_products;
DROP POLICY IF EXISTS "Master and suppliers can manage master products" ON public.master_products;
DROP POLICY IF EXISTS "Master products base select policy" ON public.master_products;
DROP POLICY IF EXISTS "Master products base insert policy" ON public.master_products;
DROP POLICY IF EXISTS "Master products base update policy" ON public.master_products;
DROP POLICY IF EXISTS "Master products base delete policy" ON public.master_products;
DROP POLICY IF EXISTS "Master products base table policy" ON public.master_products;

CREATE POLICY "Master products base table policy"
ON public.master_products FOR ALL TO authenticated
USING (
    public.is_master()
    OR (
        supplier_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM public.suppliers s 
            WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
        )
    )
)
WITH CHECK (
    public.is_master()
    OR (
        supplier_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM public.suppliers s 
            WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
        )
    )
);

DROP VIEW IF EXISTS public.available_master_products CASCADE;
CREATE OR REPLACE VIEW public.available_master_products WITH (security_invoker = false) AS
SELECT 
    id,
    sku,
    name,
    description,
    image_url,
    category,
    base_price_pub,
    status,
    is_available,
    jsonb_strip_nulls(
        jsonb_build_object(
            'external_id', metadata->>'external_id',
            'brand', metadata->>'brand',
            'attributes', metadata->'attributes'
        )
    ) AS metadata,
    created_at,
    updated_at
FROM public.master_products
WHERE is_available = true AND status = 'active';

GRANT SELECT ON public.available_master_products TO authenticated;


-- ------------------------------------------------------------------------------
-- 5. PRODUCTS & STOREFRONT VIEW
-- ------------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Store owners can manage products" ON public.products;
DROP POLICY IF EXISTS "Store owners and master can manage products" ON public.products;
DROP POLICY IF EXISTS "Store products base policy" ON public.products;

CREATE POLICY "Store products base policy"
ON public.products FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.owner_id = auth.uid())
    OR public.is_master()
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.owner_id = auth.uid())
    OR public.is_master()
);

DROP VIEW IF EXISTS public.public_store_products CASCADE;
CREATE OR REPLACE VIEW public.public_store_products WITH (security_invoker = false) AS
SELECT 
    id,
    store_id,
    master_product_id,
    COALESCE(custom_name, name) AS name,
    COALESCE(custom_description, '') AS description,
    price,
    stock,
    COALESCE(custom_image_url, image_url) AS image_url,
    status,
    created_at,
    updated_at
FROM public.products
WHERE status = 'active';

GRANT SELECT ON public.public_store_products TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 6. CUSTOMERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners can view their customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners and master can view customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners and checkout can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners and master can update customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners and master can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Customers select policy" ON public.customers;
DROP POLICY IF EXISTS "Customers authenticated insert policy" ON public.customers;
DROP POLICY IF EXISTS "Customers anonymous checkout insert policy" ON public.customers;
DROP POLICY IF EXISTS "Customers update policy" ON public.customers;
DROP POLICY IF EXISTS "Customers delete policy" ON public.customers;

CREATE POLICY "Customers select policy"
ON public.customers FOR SELECT TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.stores s ON o.store_id = s.id
        WHERE o.customer_id = customers.id AND s.owner_id = auth.uid()
    )
    OR public.is_master()
);

CREATE POLICY "Customers authenticated insert policy"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
    ))
    OR public.is_master()
);

CREATE POLICY "Customers anonymous checkout insert policy"
ON public.customers FOR INSERT TO anon
WITH CHECK (
    store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active'
    )
);

CREATE POLICY "Customers update policy"
ON public.customers FOR UPDATE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()
    ))
    OR public.is_master()
);

CREATE POLICY "Customers delete policy"
ON public.customers FOR DELETE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()
    ))
    OR public.is_master()
);


-- ------------------------------------------------------------------------------
-- 7. MARKETING EVENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.marketing_events ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Store owners and master can view marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Authorized users can insert marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Store owners and master can update marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Store owners and master can delete marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events select policy" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events authenticated insert policy" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events anonymous tracking insert policy" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events update policy" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events delete policy" ON public.marketing_events;

CREATE POLICY "Marketing events select policy"
ON public.marketing_events FOR SELECT TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR public.is_master()
);

CREATE POLICY "Marketing events authenticated insert policy"
ON public.marketing_events FOR INSERT TO authenticated
WITH CHECK (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
    ))
    OR public.is_master()
);

CREATE POLICY "Marketing events anonymous tracking insert policy"
ON public.marketing_events FOR INSERT TO anon
WITH CHECK (
    store_id IS NOT NULL 
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
    AND public.check_customer_store_match(customer_id, store_id)
);

CREATE POLICY "Marketing events update policy"
ON public.marketing_events FOR UPDATE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR public.is_master()
);

CREATE POLICY "Marketing events delete policy"
ON public.marketing_events FOR DELETE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR public.is_master()
);


-- ------------------------------------------------------------------------------
-- 8. ORDERS & INFLUENCER/AFFILIATE VIEW
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Influencers can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Orders base table access policy" ON public.orders;

CREATE POLICY "Orders base table access policy"
ON public.orders FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id AND s.owner_id = auth.uid())
    OR public.is_master()
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id AND s.owner_id = auth.uid())
    OR public.is_master()
);

-- Influencer / Affiliate View: strict database-level WHERE filter by user identity
CREATE OR REPLACE VIEW public.influencer_orders WITH (security_invoker = false) AS
SELECT 
    id,
    external_id,
    store_id,
    customer_id,
    influencer_id,
    affiliate_id,
    amount,
    shipping,
    tax,
    discount,
    status,
    fulfillment_status,
    tracking_code,
    created_at
FROM public.orders
WHERE 
    (influencer_id IS NOT NULL AND influencer_id = auth.uid())
    OR (affiliate_id IS NOT NULL AND affiliate_id = auth.uid())
    OR public.is_master();

REVOKE ALL ON public.influencer_orders FROM anon, public;
GRANT SELECT ON public.influencer_orders TO authenticated;


-- ------------------------------------------------------------------------------
-- 9. COMMISSIONS
-- ------------------------------------------------------------------------------
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own commissions" ON public.commissions;
DROP POLICY IF EXISTS "Commissions access policy" ON public.commissions;

CREATE POLICY "Commissions access policy"
ON public.commissions FOR ALL TO authenticated
USING (
    profile_id = auth.uid()
    OR public.is_master()
)
WITH CHECK (
    profile_id = auth.uid()
    OR public.is_master()
);


-- ------------------------------------------------------------------------------
-- 10. WALLETS & 11. WALLET TRANSACTIONS
-- ------------------------------------------------------------------------------
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Wallets access policy" ON public.wallets;

CREATE POLICY "Wallets access policy"
ON public.wallets FOR ALL TO authenticated
USING (
    profile_id = auth.uid()
    OR public.is_master()
)
WITH CHECK (
    profile_id = auth.uid()
    OR public.is_master()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Wallet transactions access policy" ON public.wallet_transactions;

CREATE POLICY "Wallet transactions access policy"
ON public.wallet_transactions FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_transactions.wallet_id AND w.profile_id = auth.uid())
    OR public.is_master()
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_transactions.wallet_id AND w.profile_id = auth.uid())
    OR public.is_master()
);
