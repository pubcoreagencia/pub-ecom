-- 1. Enum for Roles
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS enum ('MASTER', 'LOJISTA', 'FORNECEDOR', 'AFILIADO', 'INFLUENCER');
    END IF;
END $$;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    role public.app_role NOT NULL DEFAULT 'LOJISTA',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile') THEN
        CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile') THEN
        CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated 
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 3. Stores Table
CREATE TABLE IF NOT EXISTS public.stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subdomain text UNIQUE NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can view their own stores') THEN
        CREATE POLICY "Owners can view their own stores" ON public.stores FOR SELECT TO authenticated USING (auth.uid() = owner_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can manage their own stores') THEN
        CREATE POLICY "Owners can manage their own stores" ON public.stores FOR ALL TO authenticated USING (auth.uid() = owner_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view active stores by subdomain') THEN
        CREATE POLICY "Public can view active stores by subdomain" ON public.stores FOR SELECT TO anon USING (status = 'active');
    END IF;
END $$;

-- 4. Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view suppliers') THEN
        CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
        );
    END IF;
END $$;

-- 5. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price decimal(12,2) NOT NULL,
    cost decimal(12,2) NOT NULL,
    supplier_id uuid REFERENCES public.suppliers(id),
    store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    stock integer NOT NULL DEFAULT 0,
    image_url text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage products') THEN
        CREATE POLICY "Store owners can manage products" ON public.products FOR ALL TO authenticated USING (
            EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
        );
    END IF;
END $$;

-- 6. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view customers') THEN
        CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT TO authenticated USING (
            (store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()))
            OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MASTER')
        );
    END IF;
END $$;

-- 7. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id text,
    store_id uuid NOT NULL REFERENCES public.stores(id),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    influencer_id uuid REFERENCES public.profiles(id),
    affiliate_id uuid REFERENCES public.profiles(id),
    amount decimal(12,2) NOT NULL,
    cost decimal(12,2) NOT NULL,
    shipping decimal(12,2) NOT NULL DEFAULT 0,
    tax decimal(12,2) NOT NULL DEFAULT 0,
    discount decimal(12,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    net_profit decimal(12,2) GENERATED ALWAYS AS (amount - cost - shipping - tax - discount) STORED,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can view their orders') THEN
        CREATE POLICY "Store owners can view their orders" ON public.orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Influencers can view their orders') THEN
        CREATE POLICY "Influencers can view their orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = influencer_id);
    END IF;
END $$;

-- 8. Commissions Table
CREATE TABLE IF NOT EXISTS public.commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id),
    amount decimal(12,2) NOT NULL,
    type text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their commissions') THEN
        CREATE POLICY "Users can view their commissions" ON public.commissions FOR SELECT TO authenticated USING (auth.uid() = profile_id);
    END IF;
END $$;

-- 9. Financial Transactions
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id),
    order_id uuid REFERENCES public.orders(id),
    amount decimal(12,2) NOT NULL,
    type text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can view their transactions') THEN
        CREATE POLICY "Store owners can view their transactions" ON public.financial_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid()));
    END IF;
END $$;
