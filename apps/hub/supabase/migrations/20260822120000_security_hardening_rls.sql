-- ==============================================================================
-- MIGRATION: 20260822120000_security_hardening_rls.sql
-- DESCRIPTION: Security Hardening & Tenant Isolation across PUB ECOM / PubecomHub
-- TARGETS:
--   1. Marketing Events: Strict store/tenant isolation (fixes CRITICAL)
--   2. Customers: Strict store/tenant isolation for contact info (fixes CRITICAL)
--   3. Products: Hide product cost and profit margin from public view (fixes WARNING)
--   4. Master Products: Hide supplier_cost from standard authenticated users (fixes WARNING)
--   5. Suppliers: Strict access control on supplier directory (fixes WARNING)
-- ==============================================================================

-- 1. MARKETING EVENTS HARDENING
-- Add store_id to marketing_events if missing for multi-tenant binding
ALTER TABLE public.marketing_events ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Drop insecure open policy
DROP POLICY IF EXISTS "Authenticated users can manage marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can manage marketing events for their stores" ON public.marketing_events;

-- Enable RLS
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- SELECT: Store owners and MASTER role only
CREATE POLICY "Store owners and master can view marketing events"
ON public.marketing_events FOR SELECT TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

-- INSERT: Store owners for their stores or storefront event capture for active stores
CREATE POLICY "Authorized users can insert marketing events"
ON public.marketing_events FOR INSERT TO anon, authenticated
WITH CHECK (
    store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = store_id AND (s.status = 'active' OR s.owner_id = auth.uid())
    )
);

-- UPDATE/DELETE: Store owners and MASTER role only
CREATE POLICY "Store owners and master can update marketing events"
ON public.marketing_events FOR UPDATE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

CREATE POLICY "Store owners and master can delete marketing events"
ON public.marketing_events FOR DELETE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);


-- 2. CUSTOMERS CONTACT INFORMATION HARDENING
-- Add store_id to customers if missing
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Drop insecure open policy
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Store owners can view their customers" ON public.customers;

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- SELECT: Only store owners associated with this customer or MASTER role
CREATE POLICY "Store owners and master can view customers"
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

-- INSERT: Store owners or checkout flow for active store
CREATE POLICY "Store owners and checkout can insert customers"
ON public.customers FOR INSERT TO anon, authenticated
WITH CHECK (
    store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = store_id AND (s.status = 'active' OR s.owner_id = auth.uid())
    )
);

-- UPDATE/DELETE: Store owners and MASTER role only
CREATE POLICY "Store owners and master can update customers"
ON public.customers FOR UPDATE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);

CREATE POLICY "Store owners and master can delete customers"
ON public.customers FOR DELETE TO authenticated
USING (
    (store_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()
    ))
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
);


-- 3. PRODUCT COST & PROFIT MARGIN PROTECTION
-- Drop insecure open policies on products
DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Store owners can manage products" ON public.products;

-- Direct table access on public.products: Restricted to Store Owners and MASTER
CREATE POLICY "Store owners and master can manage products"
ON public.products FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
);

-- Create secure view for public storefront browsing (omitting cost and profit_margin)
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


-- 4. MASTER PRODUCT SUPPLIER COST PROTECTION
-- Drop insecure open policy on master_products
DROP POLICY IF EXISTS "Master products are viewable by all authenticated users" ON public.master_products;

-- Direct table access on public.master_products (including supplier_cost): MASTER and Supplier only
CREATE POLICY "Master and suppliers can view full master products"
ON public.master_products FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (supplier_id IS NOT NULL AND auth.uid() = supplier_id)
);

CREATE POLICY "Master and suppliers can manage master products"
ON public.master_products FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (supplier_id IS NOT NULL AND auth.uid() = supplier_id)
);

-- Create commercial view for lojistas/authenticated catalog browsing (omitting supplier_cost)
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
    metadata,
    created_at,
    updated_at
FROM public.master_products
WHERE is_available = true AND status = 'active';

GRANT SELECT ON public.available_master_products TO authenticated;


-- 5. SUPPLIERS DIRECTORY PROTECTION
-- Drop insecure open policy on suppliers
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;

-- Direct access on suppliers: MASTER, Supplier self, or Store Owner with active supplier relationship
CREATE POLICY "Authorized users can view suppliers"
ON public.suppliers FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (id = auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.supplier_id = suppliers.id AND s.owner_id = auth.uid()
    )
);

CREATE POLICY "Master and suppliers can manage suppliers"
ON public.suppliers FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (id = auth.uid())
);
