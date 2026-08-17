-- ==========================================
-- Migration 00015: Anon HTTP API Privileges
-- ==========================================

-- 1. store_products
GRANT SELECT ON public.store_products TO anon;

-- 2. store_product_variants
GRANT SELECT ON public.store_product_variants TO anon;

-- 3. store_domains
GRANT SELECT ON public.store_domains TO anon;

-- 4. create_checkout RPC
GRANT EXECUTE ON FUNCTION public.create_checkout(uuid, uuid, uuid, text) TO anon;
