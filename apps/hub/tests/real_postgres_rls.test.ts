import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";

describe("Real PostgreSQL Engine RLS Hardening Suite (PGlite)", () => {
  let pg: PGlite;

  const MASTER_UID = "00000000-0000-0000-0000-000000000001";
  const LOJISTA_A_UID = "11111111-1111-1111-1111-111111111111";
  const LOJISTA_B_UID = "22222222-2222-2222-2222-222222222222";
  const FORNECEDOR_A_UID = "33333333-3333-3333-3333-333333333333";
  const FORNECEDOR_B_UID = "44444444-4444-4444-4444-444444444444";
  const INFLUENCER_A_UID = "55555555-5555-5555-5555-555555555555";
  const INFLUENCER_B_UID = "66666666-6666-6666-6666-666666666666";
  const AFFILIATE_A_UID = "77777777-7777-7777-7777-777777777777";

  const STORE_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const STORE_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const SUPPLIER_A_ID = "caaaaaaa-0000-0000-0000-000000000001";
  const SUPPLIER_B_ID = "cbbbbbbb-0000-0000-0000-000000000002";

  const MP_A_ID = "baaaaaaa-0000-0000-0000-000000000001";
  const MP_B_ID = "baaaaaaa-0000-0000-0000-000000000002";

  const PROD_A_ID = "daaaaaaa-0000-0000-0000-000000000001";
  const PROD_B_ID = "daaaaaaa-0000-0000-0000-000000000002";

  const CUST_A_ID = "eaaaaaaa-0000-0000-0000-000000000001";
  const CUST_B_ID = "eaaaaaaa-0000-0000-0000-000000000002";

  const EVT_A_ID = "faaaaaaa-0000-0000-0000-000000000001";
  const EVT_B_ID = "faaaaaaa-0000-0000-0000-000000000002";

  async function asUser(uid: string | null, role: "authenticated" | "anon" = "authenticated") {
    await pg.exec(`SET ROLE web_user;`);
    if (uid) {
      await pg.query(`SELECT set_config('request.jwt.claim.sub', '${uid}', false)`);
      await pg.query(`SELECT set_config('request.jwt.claim.role', '${role}', false)`);
    } else {
      await pg.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
      await pg.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`);
    }
  }

  beforeAll(async () => {
    pg = new PGlite();

    // 1. Setup mock auth schema in PostgreSQL
    await pg.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
      $$ LANGUAGE sql STABLE;
    `);

    // 2. Setup All 11 Business Tables
    await pg.exec(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
          CREATE TYPE public.app_role AS enum ('MASTER', 'LOJISTA', 'FORNECEDOR', 'AFILIADO', 'INFLUENCER');
        END IF;
      END $$;

      -- 1. profiles
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL,
        role public.app_role NOT NULL DEFAULT 'LOJISTA',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      -- 2. stores
      CREATE TABLE public.stores (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        subdomain text UNIQUE NOT NULL,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz DEFAULT now()
      );

      -- 3. suppliers
      CREATE TABLE public.suppliers (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        category text,
        profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at timestamptz DEFAULT now()
      );

      -- 4. master_products
      CREATE TABLE public.master_products (
        id uuid PRIMARY KEY,
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

      -- 5. products
      CREATE TABLE public.products (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        price decimal(12,2) NOT NULL,
        cost decimal(12,2) NOT NULL,
        profit_margin decimal(12,2) DEFAULT 0,
        supplier_id uuid REFERENCES public.suppliers(id),
        store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
        master_product_id uuid REFERENCES public.master_products(id),
        custom_name text,
        custom_description text,
        custom_image_url text,
        stock integer NOT NULL DEFAULT 0,
        status text DEFAULT 'active',
        image_url text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      -- 6. customers
      CREATE TABLE public.customers (
        id uuid PRIMARY KEY,
        store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
        name text NOT NULL,
        email text NOT NULL,
        phone text,
        created_at timestamptz DEFAULT now()
      );

      -- 7. orders
      CREATE TABLE public.orders (
        id uuid PRIMARY KEY,
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
        fulfillment_status text DEFAULT 'pending',
        tracking_code text,
        financial_metadata jsonb DEFAULT '{}',
        net_profit decimal(12,2) GENERATED ALWAYS AS (amount - cost - shipping - tax - discount) STORED,
        created_at timestamptz DEFAULT now()
      );

      -- 8. marketing_events
      CREATE TABLE public.marketing_events (
        id uuid PRIMARY KEY,
        store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
        customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
        event_type text NOT NULL,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz DEFAULT now()
      );

      -- 9. commissions
      CREATE TABLE public.commissions (
        id uuid PRIMARY KEY,
        order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        amount decimal(12,2) NOT NULL,
        type text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz DEFAULT now()
      );

      -- 10. wallets
      CREATE TABLE public.wallets (
        id uuid PRIMARY KEY,
        profile_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        balance decimal(12,2) NOT NULL DEFAULT 0,
        currency text NOT NULL DEFAULT 'BRL',
        updated_at timestamptz DEFAULT now()
      );

      -- 11. wallet_transactions
      CREATE TABLE public.wallet_transactions (
        id uuid PRIMARY KEY,
        wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
        type text NOT NULL,
        amount decimal(12,2) NOT NULL,
        description text,
        created_at timestamptz DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION public.is_master()
      RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'MASTER');
      $$;

      CREATE OR REPLACE FUNCTION public.check_customer_store_match(p_customer_id uuid, p_store_id uuid)
      RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND store_id = p_store_id);
      $$;
    `);

    // 3. Apply Hardening RLS Policies & Views across all 11 Tables
    await pg.exec(`
      -- 1. profiles RLS & Triggers
      CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
          IF NOT public.is_master() THEN
            RAISE EXCEPTION 'Forbidden: Only MASTER administrators can change user roles.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
      CREATE TRIGGER trg_prevent_role_escalation
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT
      USING (
        id = auth.uid() 
        OR public.is_master()
      );
      CREATE POLICY "Profiles update policy" ON public.profiles FOR UPDATE
      USING (
        id = auth.uid() 
        OR public.is_master()
      )
      WITH CHECK (
        (id = auth.uid() AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR public.is_master()))
        OR public.is_master()
      );

      -- 2. stores RLS
      ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Stores select policy" ON public.stores FOR SELECT
      USING (
        status = 'active'
        OR owner_id = auth.uid()
        OR public.is_master()
      );
      CREATE POLICY "Stores modify policy" ON public.stores FOR ALL
      USING (
        owner_id = auth.uid()
        OR public.is_master()
      );

      -- 3. suppliers RLS & Commercial View
      ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Suppliers base table access policy" ON public.suppliers FOR ALL
      USING (
        public.is_master()
        OR (profile_id IS NOT NULL AND profile_id = auth.uid())
      )
      WITH CHECK (
        public.is_master()
        OR (profile_id IS NOT NULL AND profile_id = auth.uid())
      );

      CREATE OR REPLACE VIEW public.public_suppliers WITH (security_invoker = false) AS
      SELECT DISTINCT s.id, s.name, s.category, s.created_at
      FROM public.suppliers s
      JOIN public.master_products mp ON mp.supplier_id = s.id
      WHERE mp.is_available = true AND mp.status = 'active';

      -- 4. master_products RLS & Commercial View
      ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Master products base table policy" ON public.master_products FOR ALL
      USING (
        public.is_master()
        OR (
          supplier_id IS NOT NULL 
          AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid())
        )
      )
      WITH CHECK (
        public.is_master()
        OR (
          supplier_id IS NOT NULL 
          AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = master_products.supplier_id AND s.profile_id = auth.uid())
        )
      );

      CREATE OR REPLACE VIEW public.available_master_products WITH (security_invoker = false) AS
      SELECT 
        id, sku, name, description, image_url, category, base_price_pub, status, is_available,
        jsonb_strip_nulls(
          jsonb_build_object(
            'external_id', metadata->>'external_id',
            'brand', metadata->>'brand',
            'attributes', metadata->'attributes'
          )
        ) AS metadata,
        created_at, updated_at
      FROM public.master_products
      WHERE is_available = true AND status = 'active';

      -- 5. products RLS & Storefront View
      ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Store products base policy" ON public.products FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.owner_id = auth.uid())
        OR public.is_master()
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.owner_id = auth.uid())
        OR public.is_master()
      );

      CREATE OR REPLACE VIEW public.public_store_products WITH (security_invoker = false) AS
      SELECT id, store_id, master_product_id, COALESCE(custom_name, name) AS name, COALESCE(custom_description, '') AS description, price, stock, COALESCE(custom_image_url, image_url) AS image_url, status, created_at, updated_at
      FROM public.products WHERE status = 'active';

      -- 6. customers RLS
      ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Customers select policy" ON public.customers FOR SELECT
      USING (
        (store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.owner_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM public.orders o JOIN public.stores s ON o.store_id = s.id WHERE o.customer_id = customers.id AND s.owner_id = auth.uid())
        OR public.is_master()
      );

      CREATE POLICY "Customers authenticated insert policy" ON public.customers FOR INSERT
      WITH CHECK (
        (auth.role() = 'authenticated' AND store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
        OR (auth.role() = 'authenticated' AND public.is_master())
      );

      CREATE POLICY "Customers anonymous checkout insert policy" ON public.customers FOR INSERT
      WITH CHECK (
        auth.role() = 'anon' AND store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
      );

      -- 7. orders RLS & influencer_orders View
      ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Orders base table access policy" ON public.orders FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id AND s.owner_id = auth.uid())
        OR public.is_master()
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id AND s.owner_id = auth.uid())
        OR public.is_master()
      );

      CREATE OR REPLACE VIEW public.influencer_orders WITH (security_invoker = false) AS
      SELECT id, external_id, store_id, customer_id, influencer_id, affiliate_id, amount, shipping, tax, discount, status, fulfillment_status, tracking_code, created_at
      FROM public.orders
      WHERE 
        (auth.role() = 'authenticated' AND influencer_id IS NOT NULL AND influencer_id = auth.uid())
        OR (auth.role() = 'authenticated' AND affiliate_id IS NOT NULL AND affiliate_id = auth.uid())
        OR public.is_master();

      -- 8. marketing_events RLS
      ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Marketing events select policy" ON public.marketing_events FOR SELECT
      USING (
        (store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = marketing_events.store_id AND s.owner_id = auth.uid()))
        OR public.is_master()
      );

      CREATE POLICY "Marketing events authenticated insert policy" ON public.marketing_events FOR INSERT
      WITH CHECK (
        (auth.role() = 'authenticated' AND store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
        OR (auth.role() = 'authenticated' AND public.is_master())
      );

      CREATE POLICY "Marketing events anonymous tracking insert policy" ON public.marketing_events FOR INSERT
      WITH CHECK (
        auth.role() = 'anon'
        AND store_id IS NOT NULL 
        AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
        AND public.check_customer_store_match(customer_id, store_id)
      );

      -- 9. commissions RLS
      ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Commissions access policy" ON public.commissions FOR ALL
      USING (
        profile_id = auth.uid()
        OR public.is_master()
      );

      -- 10. wallets RLS & 11. wallet_transactions RLS
      ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Wallets access policy" ON public.wallets FOR ALL
      USING (
        profile_id = auth.uid()
        OR public.is_master()
      );

      ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Wallet transactions access policy" ON public.wallet_transactions FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_transactions.wallet_id AND w.profile_id = auth.uid())
        OR public.is_master()
      );
    `);

    // 4. Seed database
    await pg.exec(`
      INSERT INTO public.profiles (id, name, email, role) VALUES
        ('${MASTER_UID}', 'Admin Master', 'admin@pubholding.com', 'MASTER'),
        ('${LOJISTA_A_UID}', 'Lojista Alpha', 'lojista.a@store.com', 'LOJISTA'),
        ('${LOJISTA_B_UID}', 'Lojista Beta', 'lojista.b@store.com', 'LOJISTA'),
        ('${FORNECEDOR_A_UID}', 'Fornecedor A', 'forn.a@supplier.com', 'FORNECEDOR'),
        ('${FORNECEDOR_B_UID}', 'Fornecedor B', 'forn.b@supplier.com', 'FORNECEDOR'),
        ('${INFLUENCER_A_UID}', 'Influencer Star A', 'influencer.a@media.com', 'INFLUENCER'),
        ('${INFLUENCER_B_UID}', 'Influencer Star B', 'influencer.b@media.com', 'INFLUENCER'),
        ('${AFFILIATE_A_UID}', 'Affiliate Pro A', 'affiliate.a@media.com', 'AFILIADO');

      INSERT INTO public.stores (id, name, owner_id, subdomain, status) VALUES
        ('${STORE_A_ID}', 'Loja Alpha', '${LOJISTA_A_UID}', 'alpha', 'active'),
        ('${STORE_B_ID}', 'Loja Beta', '${LOJISTA_B_UID}', 'beta', 'active');

      INSERT INTO public.suppliers (id, name, category, profile_id) VALUES
        ('${SUPPLIER_A_ID}', 'Fornecedor A LTDA', 'Calçados', '${FORNECEDOR_A_UID}'),
        ('${SUPPLIER_B_ID}', 'Fornecedor B LTDA', 'Eletrônicos', '${FORNECEDOR_B_UID}');

      INSERT INTO public.master_products (id, supplier_id, sku, name, supplier_cost, base_price_pub, status, is_available, metadata) VALUES
        ('${MP_A_ID}', '${SUPPLIER_A_ID}', 'SKU-A1', 'Babuche Alpha Zentta', 18.50, 39.90, 'active', true, '{"external_id": "1729928484", "brand": "Zentta", "supplier_secret_note": "Confidencial", "private_margin": 0.12}'),
        ('${MP_B_ID}', '${SUPPLIER_B_ID}', 'SKU-B1', 'Smartwatch Beta Lux', 45.00, 99.00, 'active', true, '{"external_id": "888888", "internal_tax": 0.15}');

      INSERT INTO public.products (id, store_id, supplier_id, name, price, cost, profit_margin, stock, status) VALUES
        ('${PROD_A_ID}', '${STORE_A_ID}', '${SUPPLIER_A_ID}', 'Babuche Conforto Alpha', 79.90, 39.90, 40.00, 100, 'active'),
        ('${PROD_B_ID}', '${STORE_B_ID}', '${SUPPLIER_B_ID}', 'Smartwatch Beta Edition', 189.90, 99.00, 90.90, 50, 'active');

      INSERT INTO public.customers (id, store_id, name, email, phone) VALUES
        ('${CUST_A_ID}', '${STORE_A_ID}', 'Cliente Alpha Privado', 'cliente.a@privado.com', '+5511999990001'),
        ('${CUST_B_ID}', '${STORE_B_ID}', 'Cliente Beta Privado', 'cliente.b@privado.com', '+5521999990002');

      INSERT INTO public.orders (id, store_id, customer_id, influencer_id, affiliate_id, amount, cost, shipping, status) VALUES
        ('10000000-0000-0000-0000-000000000001', '${STORE_A_ID}', '${CUST_A_ID}', '${INFLUENCER_A_UID}', NULL, 79.90, 39.90, 10.00, 'paid'),
        ('10000000-0000-0000-0000-000000000002', '${STORE_B_ID}', '${CUST_B_ID}', NULL, '${AFFILIATE_A_UID}', 189.90, 99.00, 15.00, 'paid');

      INSERT INTO public.marketing_events (id, store_id, customer_id, event_type) VALUES
        ('${EVT_A_ID}', '${STORE_A_ID}', '${CUST_A_ID}', 'PAGE_VIEW'),
        ('${EVT_B_ID}', '${STORE_B_ID}', '${CUST_B_ID}', 'CHECKOUT_STARTED');

      INSERT INTO public.commissions (id, order_id, profile_id, amount, type, status) VALUES
        ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '${INFLUENCER_A_UID}', 15.00, 'influencer', 'pending');

      INSERT INTO public.wallets (id, profile_id, balance) VALUES
        ('30000000-0000-0000-0000-000000000001', '${INFLUENCER_A_UID}', 150.00);

      INSERT INTO public.wallet_transactions (id, wallet_id, type, amount, description) VALUES
        ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'credit', 150.00, 'Comissao Inicial');
    `);

    // 5. Setup web_user role without bypassrls
    await pg.exec(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_user') THEN
          CREATE ROLE web_user NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;

      GRANT USAGE ON SCHEMA public TO web_user;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO web_user;
      GRANT ALL ON ALL ROUTINES IN SCHEMA public TO web_user;
      GRANT USAGE ON SCHEMA auth TO web_user;
      GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO web_user;
    `);
  });

  describe("0. SQL Audit on all 11 Business Tables in pg_class and pg_policies", () => {
    it("All 11 business tables must have relrowsecurity = true in pg_class", async () => {
      const tables = [
        "profiles",
        "stores",
        "suppliers",
        "master_products",
        "products",
        "customers",
        "marketing_events",
        "orders",
        "commissions",
        "wallets",
        "wallet_transactions",
      ];

      const res = await pg.query<{ relname: string; relrowsecurity: boolean }>(
        `
        SELECT relname, relrowsecurity 
        FROM pg_class 
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public' AND relname = ANY($1)
      `,
        [tables],
      );

      expect(res.rows.length).toBe(11);
      for (const row of res.rows) {
        expect(row.relrowsecurity).toBe(true);
      }
    });

    it("Zero policies on business tables must contain permissive USING (true) or WITH CHECK (true)", async () => {
      const res = await pg.query<{
        tablename: string;
        policyname: string;
        qual: string;
        with_check: string;
      }>(`
        SELECT tablename, policyname, qual, with_check 
        FROM pg_policies 
        WHERE schemaname = 'public'
      `);

      for (const p of res.rows) {
        if (p.qual) {
          expect(p.qual.trim()).not.toBe("true");
          expect(p.qual.trim()).not.toBe("(true)");
        }
        if (p.with_check) {
          expect(p.with_check.trim()).not.toBe("true");
          expect(p.with_check.trim()).not.toBe("(true)");
        }
      }
    });
  });

  describe("1. Suppliers RLS & Commercial View", () => {
    it("MASTER can read all suppliers (A and B)", async () => {
      await asUser(MASTER_UID);
      const res = await pg.query<{ id: string }>("SELECT id FROM public.suppliers");
      expect(res.rows.length).toBe(2);
    });

    it("FORNECEDOR A can read only own supplier (A) and NOT supplier B", async () => {
      await asUser(FORNECEDOR_A_UID);
      const res = await pg.query<{ id: string }>("SELECT id FROM public.suppliers");
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe(SUPPLIER_A_ID);
    });

    it("LOJISTA gets 0 rows from base suppliers table (DENY)", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query("SELECT * FROM public.suppliers");
      expect(res.rows.length).toBe(0);
    });

    it("ANON gets 0 rows from base suppliers table (DENY)", async () => {
      await asUser(null, "anon");
      const res = await pg.query("SELECT * FROM public.suppliers");
      expect(res.rows.length).toBe(0);
    });

    it("public_suppliers view is accessible by authenticated users, exposes only non-sensitive catalog fields without private notes", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query<any>("SELECT * FROM public.public_suppliers");
      expect(res.rows.length).toBe(2);
      expect(res.rows[0].name).toBe("Fornecedor A LTDA");
      expect(res.rows[0].profile_id).toBeUndefined();
    });
  });

  describe("2. Master Products RLS & Commercial View", () => {
    it("MASTER can read all master products with supplier_cost", async () => {
      await asUser(MASTER_UID);
      const res = await pg.query<{ sku: string; supplier_cost: number }>(
        "SELECT sku, supplier_cost FROM public.master_products",
      );
      expect(res.rows.length).toBe(2);
      expect(Number(res.rows[0].supplier_cost)).toBeGreaterThan(0);
    });

    it("FORNECEDOR A can read own master products and NOT product from Supplier B", async () => {
      await asUser(FORNECEDOR_A_UID);
      const res = await pg.query<{ sku: string; supplier_cost: number }>(
        "SELECT sku, supplier_cost FROM public.master_products",
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].sku).toBe("SKU-A1");
      expect(Number(res.rows[0].supplier_cost)).toBe(18.5);
    });

    it("LOJISTA gets 0 rows on base master_products table (direct supplier_cost access DENIED)", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query("SELECT * FROM public.master_products");
      expect(res.rows.length).toBe(0);
    });

    it("LOJISTA reads available_master_products view where supplier_cost is absent and private metadata is sanitized", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query<any>("SELECT * FROM public.available_master_products");
      expect(res.rows.length).toBe(2);
      expect(res.rows[0].supplier_cost).toBeUndefined();
      expect(Number(res.rows[0].base_price_pub)).toBe(39.9);
      expect(res.rows[0].metadata?.external_id).toBe("1729928484");
      expect(res.rows[0].metadata?.brand).toBe("Zentta");
      expect(res.rows[0].metadata?.supplier_secret_note).toBeUndefined();
      expect(res.rows[0].metadata?.private_margin).toBeUndefined();
    });
  });

  describe("3. Products RLS & Storefront View", () => {
    it("LOJISTA A reads Store A products with cost & margin, but gets 0 rows for Store B", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query<{ cost: number; profit_margin: number; store_id: string }>(
        "SELECT cost, profit_margin, store_id FROM public.products",
      );
      expect(res.rows.length).toBe(1);
      expect(Number(res.rows[0].cost)).toBe(39.9);
      expect(Number(res.rows[0].profit_margin)).toBe(40.0);
      expect(res.rows[0].store_id).toBe(STORE_A_ID);
    });

    it("ANON gets 0 rows on base products table (DENY)", async () => {
      await asUser(null, "anon");
      const res = await pg.query("SELECT * FROM public.products");
      expect(res.rows.length).toBe(0);
    });

    it("public_store_products view strictly excludes cost, profit_margin, and supplier_id", async () => {
      await asUser(null, "anon");
      const res = await pg.query<any>(
        `SELECT * FROM public.public_store_products WHERE store_id = '${STORE_A_ID}'`,
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].name).toBe("Babuche Conforto Alpha");
      expect(Number(res.rows[0].price)).toBe(79.9);
      expect(res.rows[0].cost).toBeUndefined();
      expect(res.rows[0].profit_margin).toBeUndefined();
      expect(res.rows[0].supplier_id).toBeUndefined();
    });
  });

  describe("4. Customers Multi-Tenant RLS & Injection Prevention", () => {
    it("LOJISTA A reads only Store A customers, getting 0 rows for Store B", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query<{ email: string; store_id: string }>(
        "SELECT email, store_id FROM public.customers",
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].email).toBe("cliente.a@privado.com");
      expect(res.rows[0].store_id).toBe(STORE_A_ID);
    });

    it("Cross-tenant INSERT by authenticated LOJISTA A into Store B is DENIED by PostgreSQL", async () => {
      await asUser(LOJISTA_A_UID);
      let errorThrown = false;
      try {
        await pg.query(`
          INSERT INTO public.customers (id, store_id, name, email, phone)
          VALUES ('eaaaaaaa-0000-0000-0000-000000000099', '${STORE_B_ID}', 'Hacker', 'hacker@bad.com', '000')
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toContain("violates row-level security policy");
      }
      expect(errorThrown).toBe(true);
    });

    it("ANON checkout customer insertion succeeds for active store, but fails for non-existent/inactive store", async () => {
      await asUser(null, "anon");
      const res = await pg.query(`
        INSERT INTO public.customers (id, store_id, name, email, phone)
        VALUES ('eaaaaaaa-0000-0000-0000-000000000088', '${STORE_A_ID}', 'Checkout Anon', 'anon@buyer.com', '123')
      `);
      expect(res.affectedRows).toBe(1);

      let errorThrown = false;
      try {
        await pg.query(`
          INSERT INTO public.customers (id, store_id, name, email, phone)
          VALUES ('eaaaaaaa-0000-0000-0000-000000000077', '99999999-9999-9999-9999-999999999999', 'Fake', 'fake@bad.com', '000')
        `);
      } catch (err: any) {
        errorThrown = true;
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe("5. Marketing Events Multi-Tenant RLS & Relational Consistency", () => {
    it("LOJISTA A reads only Store A marketing events", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query<{ id: string; store_id: string }>(
        "SELECT id, store_id FROM public.marketing_events",
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe(EVT_A_ID);
      expect(res.rows[0].store_id).toBe(STORE_A_ID);
    });

    it("Cross-tenant INSERT by LOJISTA A into Store B is DENIED by PostgreSQL", async () => {
      await asUser(LOJISTA_A_UID);
      let errorThrown = false;
      try {
        await pg.query(`
          INSERT INTO public.marketing_events (id, store_id, customer_id, event_type)
          VALUES ('faaaaaaa-0000-0000-0000-000000000099', '${STORE_B_ID}', '${CUST_B_ID}', 'ATTACK_EVENT')
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toContain("violates row-level security policy");
      }
      expect(errorThrown).toBe(true);
    });

    it("ANON pixel tracking requires active store AND customer belonging to that same store", async () => {
      await asUser(null, "anon");
      const valid = await pg.query(`
        INSERT INTO public.marketing_events (id, store_id, customer_id, event_type)
        VALUES ('faaaaaaa-0000-0000-0000-000000000088', '${STORE_A_ID}', '${CUST_A_ID}', 'ADD_TO_CART')
      `);
      expect(valid.affectedRows).toBe(1);

      let errorThrown = false;
      try {
        await pg.query(`
          INSERT INTO public.marketing_events (id, store_id, customer_id, event_type)
          VALUES ('faaaaaaa-0000-0000-0000-000000000077', '${STORE_A_ID}', '${CUST_B_ID}', 'FRAUD_EVENT')
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toContain("violates row-level security policy");
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe("6. Orders Base Table & Influencer View RLS Hardening", () => {
    it("LOJISTA A reads only Store A orders with cost and net_profit", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query<{ amount: number; cost: number; net_profit: number }>(
        "SELECT amount, cost, net_profit FROM public.orders",
      );
      expect(res.rows.length).toBe(1);
      expect(Number(res.rows[0].amount)).toBe(79.9);
      expect(Number(res.rows[0].cost)).toBe(39.9);
      expect(Number(res.rows[0].net_profit)).toBe(30.0);
    });

    it("LOJISTA B gets 0 rows for Store A orders on base table", async () => {
      await asUser(LOJISTA_B_UID);
      const res = await pg.query<{ id: string; store_id: string }>(
        `SELECT id, store_id FROM public.orders WHERE store_id = '${STORE_A_ID}'`,
      );
      expect(res.rows.length).toBe(0);
    });

    it("FORNECEDOR gets 0 rows on base orders table (DENY)", async () => {
      await asUser(FORNECEDOR_A_UID);
      const res = await pg.query("SELECT * FROM public.orders");
      expect(res.rows.length).toBe(0);
    });

    it("INFLUENCER gets 0 rows directly on base orders table (DENY)", async () => {
      await asUser(INFLUENCER_A_UID);
      const res = await pg.query("SELECT * FROM public.orders");
      expect(res.rows.length).toBe(0);
    });

    it("INFLUENCER A sees ONLY own assigned orders in influencer_orders view", async () => {
      await asUser(INFLUENCER_A_UID);
      const res = await pg.query<any>("SELECT * FROM public.influencer_orders");
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].influencer_id).toBe(INFLUENCER_A_UID);
      expect(Number(res.rows[0].amount)).toBe(79.9);
      expect(res.rows[0].cost).toBeUndefined();
      expect(res.rows[0].net_profit).toBeUndefined();
      expect(res.rows[0].financial_metadata).toBeUndefined();
    });

    it("INFLUENCER B gets 0 rows from influencer_orders view for Influencer A orders", async () => {
      await asUser(INFLUENCER_B_UID);
      const res = await pg.query<any>("SELECT * FROM public.influencer_orders");
      expect(res.rows.length).toBe(0);
    });

    it("AFFILIATE A sees only orders assigned to affiliate_id in influencer_orders view", async () => {
      await asUser(AFFILIATE_A_UID);
      const res = await pg.query<any>("SELECT * FROM public.influencer_orders");
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].affiliate_id).toBe(AFFILIATE_A_UID);
      expect(Number(res.rows[0].amount)).toBe(189.9);
    });

    it("LOJISTA gets 0 rows from influencer_orders view unless explicitly assigned as influencer/affiliate", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query<any>("SELECT * FROM public.influencer_orders");
      expect(res.rows.length).toBe(0);
    });
  });

  describe("7. Commissions and Wallets RLS", () => {
    it("INFLUENCER A sees only own commissions and wallet", async () => {
      await asUser(INFLUENCER_A_UID);
      const comms = await pg.query<{ id: string; amount: number }>(
        "SELECT id, amount FROM public.commissions",
      );
      expect(comms.rows.length).toBe(1);
      expect(Number(comms.rows[0].amount)).toBe(15.0);

      const wallet = await pg.query<{ balance: number }>("SELECT balance FROM public.wallets");
      expect(wallet.rows.length).toBe(1);
      expect(Number(wallet.rows[0].balance)).toBe(150.0);
    });

    it("INFLUENCER B gets 0 rows for INFLUENCER A commissions and wallet", async () => {
      await asUser(INFLUENCER_B_UID);
      const comms = await pg.query("SELECT * FROM public.commissions");
      expect(comms.rows.length).toBe(0);

      const wallet = await pg.query("SELECT * FROM public.wallets");
      expect(wallet.rows.length).toBe(0);
    });
  });

  describe("8. Role Escalation Prevention Hardening (Finding 1)", () => {
    it("LOJISTA attempting to promote self to MASTER is strictly DENIED by trigger/RLS", async () => {
      await asUser(LOJISTA_A_UID);
      await expect(
        pg.query(`UPDATE public.profiles SET role = 'MASTER' WHERE id = '${LOJISTA_A_UID}'`),
      ).rejects.toThrow(/Forbidden/);
    });

    it("FORNECEDOR attempting to promote self to MASTER is strictly DENIED", async () => {
      await asUser(FORNECEDOR_A_UID);
      await expect(
        pg.query(`UPDATE public.profiles SET role = 'MASTER' WHERE id = '${FORNECEDOR_A_UID}'`),
      ).rejects.toThrow(/Forbidden/);
    });

    it("INFLUENCER attempting to promote self to MASTER is strictly DENIED", async () => {
      await asUser(INFLUENCER_A_UID);
      await expect(
        pg.query(`UPDATE public.profiles SET role = 'MASTER' WHERE id = '${INFLUENCER_A_UID}'`),
      ).rejects.toThrow(/Forbidden/);
    });

    it("LOJISTA attempting to update someone else profile is DENIED (0 rows updated)", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query(
        `UPDATE public.profiles SET name = 'Hacked Name' WHERE id = '${LOJISTA_B_UID}' RETURNING id`,
      );
      expect(res.rows.length).toBe(0);
    });

    it("MASTER is ALLOWED to change user roles", async () => {
      await asUser(MASTER_UID);
      const res = await pg.query<{ id: string; role: string }>(
        `UPDATE public.profiles SET role = 'FORNECEDOR' WHERE id = '${LOJISTA_B_UID}' RETURNING id, role`,
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].role).toBe("FORNECEDOR");
    });

    it("LOJISTA is ALLOWED to update own non-privileged profile data (name, email)", async () => {
      await asUser(LOJISTA_A_UID);
      const res = await pg.query<{ id: string; name: string }>(
        `UPDATE public.profiles SET name = 'Lojista Updated Name' WHERE id = '${LOJISTA_A_UID}' RETURNING id, name`,
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].name).toBe("Lojista Updated Name");
    });
  });
});
