-- ==============================================================================
-- MIGRATION: 20260822130000_comprehensive_rls_hardening.sql
-- DESCRIPTION: Comprehensive RLS Hardening & Multi-Tenant Authorization for PUB ECOM
-- TARGETS:
--   1. Suppliers: Link to profiles (profile_id) + Private vs Public data separation
--   2. Master Products: Restrict supplier_cost + Safe commercial view with sanitized metadata
--   3. Products: Restrict cost & profit_margin + Safe storefront view
--   4. Customers: Strict multi-tenant isolation + Prevent cross-tenant INSERT
--   5. Marketing Events: Strict store ownership + Customer relation consistency
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SUPPLIERS SCHEMA & RLS HARDENING
-- ------------------------------------------------------------------------------
-- Add profile_id to suppliers to establish direct ownership with auth.users/profiles
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop all old supplier policies
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authorized users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Master and suppliers can manage suppliers" ON public.suppliers;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- SELECT: Full supplier row viewable only by MASTER, the supplier owner, or a store owner with active relationship
CREATE POLICY "Suppliers base table select policy"
ON public.suppliers FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (profile_id IS NOT NULL AND profile_id = auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.supplier_id = suppliers.id AND s.owner_id = auth.uid()
    )
);

-- INSERT/UPDATE/DELETE: Restricted to MASTER and the supplier owner
CREATE POLICY "Suppliers base table insert policy"
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (profile_id IS NOT NULL AND profile_id = auth.uid())
);

CREATE POLICY "Suppliers base table update policy"
ON public.suppliers FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (profile_id IS NOT NULL AND profile_id = auth.uid())
);

CREATE POLICY "Suppliers base table delete policy"
ON public.suppliers FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (profile_id IS NOT NULL AND profile_id = auth.uid())
);

-- Public Suppliers View (projecting only non-sensitive catalog info)
CREATE OR REPLACE VIEW public.public_suppliers WITH (security_invoker = false) AS
SELECT 
    id,
    name,
    category,
    created_at
FROM public.suppliers;

GRANT SELECT ON public.public_suppliers TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 2. MASTER PRODUCTS SCHEMA & RLS HARDENING
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Master products are viewable by all authenticated users" ON public.master_products;
DROP POLICY IF EXISTS "Master and suppliers can view full master products" ON public.master_products;
DROP POLICY IF EXISTS "Master and suppliers can manage master products" ON public.master_products;

ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;

-- SELECT on base table (contains supplier_cost): MASTER and the owning supplier only
CREATE POLICY "Master products base select policy"
ON public.master_products FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (
        supplier_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM public.suppliers s 
            WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
        )
    )
);

-- INSERT/UPDATE/DELETE: MASTER and owning supplier only
CREATE POLICY "Master products base insert policy"
ON public.master_products FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (
        supplier_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM public.suppliers s 
            WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
        )
    )
);

CREATE POLICY "Master products base update policy"
ON public.master_products FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (
        supplier_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM public.suppliers s 
            WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
        )
    )
);

CREATE POLICY "Master products base delete policy"
ON public.master_products FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (
        supplier_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM public.suppliers s 
            WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
        )
    )
);

-- Secure Commercial Master Products View (for Lojistas / Catalog Browsing)
-- Explicitly excludes supplier_cost and sanitizes metadata to avoid leakage of internal notes
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
-- 3. STORE PRODUCTS SCHEMA & RLS HARDENING
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Store owners can manage products" ON public.products;
DROP POLICY IF EXISTS "Store owners and master can manage products" ON public.products;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- SELECT/ALL on base table products: Store Owner and MASTER only
CREATE POLICY "Store products base policy"
ON public.products FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
);

-- Secure Storefront Products View (for public customer browsing, strictly omitting cost and profit_margin)
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
-- 4. CUSTOMERS SCHEMA & RLS HARDENING
-- ------------------------------------------------------------------------------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners can view their customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners and master can view customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners and checkout can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners and master can update customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners and master can delete customers" ON public.customers;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- SELECT: Only store owner associated with customer or MASTER
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
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

-- INSERT (Authenticated): Store Owner creating customer for OWN store or MASTER
CREATE POLICY "Customers authenticated insert policy"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

-- INSERT (Anon Checkout): Permitted only with non-null store_id belonging to active store
CREATE POLICY "Customers anonymous checkout insert policy"
ON public.customers FOR INSERT TO anon
WITH CHECK (
    store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active'
    )
);

-- UPDATE/DELETE: Store owner and MASTER only
CREATE POLICY "Customers update policy"
ON public.customers FOR UPDATE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

CREATE POLICY "Customers delete policy"
ON public.customers FOR DELETE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);


-- ------------------------------------------------------------------------------
-- 5. MARKETING EVENTS SCHEMA & RLS HARDENING
-- ------------------------------------------------------------------------------
ALTER TABLE public.marketing_events ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Authenticated users can manage marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Store owners and master can view marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Authorized users can insert marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Store owners and master can update marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Store owners and master can delete marketing events" ON public.marketing_events;

ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- SELECT: Store Owner and MASTER only
CREATE POLICY "Marketing events select policy"
ON public.marketing_events FOR SELECT TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

-- INSERT (Authenticated): Store Owner for their OWN store only (prevents cross-tenant insertion into other active stores)
CREATE POLICY "Marketing events authenticated insert policy"
ON public.marketing_events FOR INSERT TO authenticated
WITH CHECK (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

-- INSERT (Anon Pixel/Tracking): Permitted only when store_id is active AND customer_id belongs to that store
CREATE POLICY "Marketing events anonymous tracking insert policy"
ON public.marketing_events FOR INSERT TO anon
WITH CHECK (
    store_id IS NOT NULL 
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
    AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.store_id = store_id)
);

-- UPDATE/DELETE: Store Owner and MASTER only
CREATE POLICY "Marketing events update policy"
ON public.marketing_events FOR UPDATE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

CREATE POLICY "Marketing events delete policy"
ON public.marketing_events FOR DELETE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);
