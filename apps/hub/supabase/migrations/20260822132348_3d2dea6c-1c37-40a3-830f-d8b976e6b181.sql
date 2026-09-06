CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'MASTER'
  );
$$;

REVOKE ALL ON FUNCTION public.is_master() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_master() TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_user IN ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin') THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_master() THEN
      RAISE EXCEPTION 'Forbidden: Only MASTER administrators can change user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

CREATE OR REPLACE FUNCTION public.enforce_profile_insert_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
     AND NOT public.is_master() THEN
    NEW.role := 'LOJISTA';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_insert_role_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_insert_role_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_insert_role();

DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Customers select policy" ON public.customers;
DROP POLICY IF EXISTS "Customers insert policy" ON public.customers;
DROP POLICY IF EXISTS "Customers update policy" ON public.customers;
DROP POLICY IF EXISTS "Customers delete policy" ON public.customers;

CREATE POLICY "Customers select policy"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.is_master()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.customer_id = customers.id AND s.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = customers.id
      AND (o.influencer_id = auth.uid() OR o.affiliate_id = auth.uid())
  )
);

CREATE POLICY "Customers insert policy"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_master()
  OR EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
);

CREATE POLICY "Customers update policy"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  public.is_master()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.customer_id = customers.id AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Customers delete policy"
ON public.customers
FOR DELETE
TO authenticated
USING (public.is_master());

DROP POLICY IF EXISTS "Authenticated users can manage marketing events" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events select policy" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events insert policy" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events update policy" ON public.marketing_events;
DROP POLICY IF EXISTS "Marketing events delete policy" ON public.marketing_events;

CREATE POLICY "Marketing events select policy"
ON public.marketing_events
FOR SELECT
TO authenticated
USING (
  public.is_master()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.customer_id = marketing_events.customer_id AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Marketing events insert policy"
ON public.marketing_events
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_master()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.customer_id = marketing_events.customer_id AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Marketing events update policy"
ON public.marketing_events
FOR UPDATE
TO authenticated
USING (public.is_master());

CREATE POLICY "Marketing events delete policy"
ON public.marketing_events
FOR DELETE
TO authenticated
USING (public.is_master());

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authorized users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Master and suppliers can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table select policy" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table insert policy" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table update policy" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table delete policy" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers base table access policy" ON public.suppliers;

CREATE POLICY "Suppliers base table access policy"
ON public.suppliers
FOR ALL
TO authenticated
USING (
  public.is_master()
  OR (profile_id IS NOT NULL AND profile_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores st ON st.id = p.store_id
    WHERE p.supplier_id = suppliers.id AND st.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.is_master()
  OR (profile_id IS NOT NULL AND profile_id = auth.uid())
);

DROP VIEW IF EXISTS public.public_suppliers CASCADE;
CREATE OR REPLACE VIEW public.public_suppliers
WITH (security_invoker = false) AS
SELECT DISTINCT s.id, s.name, s.category, s.created_at
FROM public.suppliers s
JOIN public.master_products mp ON mp.supplier_id = s.id
WHERE mp.is_available = true AND mp.status = 'active';

REVOKE ALL ON public.public_suppliers FROM anon, public;
GRANT SELECT ON public.public_suppliers TO authenticated;

DROP POLICY IF EXISTS "Master products are viewable by all authenticated users" ON public.master_products;
DROP POLICY IF EXISTS "Master and suppliers can view full master products" ON public.master_products;
DROP POLICY IF EXISTS "Master and suppliers can manage master products" ON public.master_products;
DROP POLICY IF EXISTS "Master products base table policy" ON public.master_products;

CREATE POLICY "Master products base table policy"
ON public.master_products
FOR ALL
TO authenticated
USING (
  public.is_master()
  OR (supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
  ))
)
WITH CHECK (
  public.is_master()
  OR (supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
  ))
);

DROP VIEW IF EXISTS public.available_master_products CASCADE;
CREATE OR REPLACE VIEW public.available_master_products
WITH (security_invoker = false) AS
SELECT
  id, sku, name, description, image_url,
  base_price_pub AS commercial_price,
  category,
  NULL::integer AS weight_grams,
  is_available,
  1 AS min_quantity,
  status, created_at
FROM public.master_products
WHERE is_available = true AND status = 'active';

REVOKE ALL ON public.available_master_products FROM anon, public;
GRANT SELECT ON public.available_master_products TO authenticated;

DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Store owners can manage products" ON public.products;
DROP POLICY IF EXISTS "Store products base policy" ON public.products;

CREATE POLICY "Store products base policy"
ON public.products
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.owner_id = auth.uid()
  )
  OR public.is_master()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.owner_id = auth.uid()
  )
  OR public.is_master()
);

DROP VIEW IF EXISTS public.public_store_products CASCADE;
CREATE OR REPLACE VIEW public.public_store_products
WITH (security_invoker = false) AS
SELECT
  p.id, p.store_id,
  COALESCE(p.custom_name, p.name) AS name,
  COALESCE(p.custom_description, '') AS description,
  COALESCE(p.custom_image_url, p.image_url) AS image_url,
  p.price, p.stock,
  (p.status = 'active') AS is_active,
  p.created_at
FROM public.products p
JOIN public.stores s ON s.id = p.store_id
WHERE p.status = 'active' AND s.status = 'active';

REVOKE ALL ON public.public_store_products FROM public;
GRANT SELECT ON public.public_store_products TO anon, authenticated;