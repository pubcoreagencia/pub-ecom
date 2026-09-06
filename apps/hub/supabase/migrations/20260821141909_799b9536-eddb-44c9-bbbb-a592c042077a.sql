
-- 1. Master Products (Catálogo Master)
CREATE TABLE public.master_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    sku text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    category text,
    supplier_cost numeric(10,2) NOT NULL DEFAULT 0,
    base_price_pub numeric(10,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'active',
    is_available boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.master_products TO authenticated;
GRANT ALL ON public.master_products TO service_role;
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE POLICY "Master products are viewable by all authenticated users" ON public.master_products FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
    OR (
        supplier_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM public.suppliers s 
            WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid()
        )
    )
);

-- 2. Store Products (Produtos das Lojas)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS master_product_id uuid REFERENCES public.master_products(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS custom_name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS custom_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS custom_image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS profit_margin numeric(10,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Wallets e Transactions
CREATE TABLE public.wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    balance numeric(10,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'BRL',
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = profile_id);

CREATE TABLE public.wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL, -- 'credit', 'debit'
    amount numeric(10,2) NOT NULL,
    description text,
    reference_id uuid, -- ID da order ou commission
    reference_type text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.wallets WHERE id = wallet_id AND profile_id = auth.uid()));

-- 4. Order Tracking (Timeline do Pedido)
CREATE TABLE public.order_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    status text NOT NULL,
    message text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.order_tracking TO authenticated;
GRANT ALL ON public.order_tracking TO service_role;
ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view tracking for their orders" ON public.order_tracking FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()) OR influencer_id = auth.uid())));

-- 5. Marketing Events (CRM / Audience)
CREATE TABLE public.marketing_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    event_type text NOT NULL, -- PAGE_VIEW, ADD_TO_CART, etc.
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.marketing_events TO authenticated;
GRANT ALL ON public.marketing_events TO service_role;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage marketing events" ON public.marketing_events FOR ALL TO authenticated USING (
    (store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
);

-- 6. Ajustes Adicionais em Orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS master_product_id uuid REFERENCES public.master_products(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS financial_metadata jsonb DEFAULT '{}';
