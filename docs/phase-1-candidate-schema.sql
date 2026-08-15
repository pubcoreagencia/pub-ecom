-- ==========================================
-- 001_CORE: EXTENSÕES, TIPOS E FUNÇÕES BASE
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums de Domínio
CREATE TYPE order_status AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK');
CREATE TYPE reservation_status AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED', 'CANCELLED');
CREATE TYPE fulfillment_status AS ENUM ('PENDING', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE ledger_entry_type AS ENUM ('SALE_CREDIT', 'PRODUCT_COST', 'SHIPPING_COST', 'GATEWAY_FEE', 'PUB_FEE', 'REFUND_DEBIT', 'CHARGEBACK_DEBIT', 'CHARGEBACK_FEE', 'PAYOUT', 'ADJUSTMENT');
CREATE TYPE inventory_movement_type AS ENUM ('RECEIPT', 'RESERVE', 'RELEASE', 'COMMIT', 'RETURN', 'LOSS');

-- Função automática para updated_at (Somente tabelas mutáveis)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função Helper Segura para RLS (Evita recursão infinita)
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS SETOF uuid AS $$
  SELECT organization_id FROM public.memberships WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 002_IDENTITY: USERS, ORGS, STORES
-- ==========================================
CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    email text UNIQUE NOT NULL,
    full_name text,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    document text UNIQUE,
    status text DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_orgs BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    role text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

CREATE TABLE stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT NOT NULL,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    status text DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_stores BEFORE UPDATE ON stores FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE store_domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    domain text UNIQUE NOT NULL,
    is_primary boolean DEFAULT false,
    ssl_status text DEFAULT 'PENDING',
    created_at timestamptz DEFAULT NOW()
);

-- ==========================================
-- 003_CATALOG & INVENTORY (PUB & STORE)
-- ==========================================
CREATE TABLE suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    contact_email text,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE master_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
    base_sku text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE master_product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_product_id uuid REFERENCES master_products(id) ON DELETE CASCADE,
    sku text UNIQUE NOT NULL,
    cost_price numeric(15,2) NOT NULL DEFAULT 0.00,
    weight_grams integer DEFAULT 0,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE master_inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_variant_id uuid UNIQUE REFERENCES master_product_variants(id) ON DELETE CASCADE,
    on_hand integer NOT NULL DEFAULT 0,
    reserved integer NOT NULL DEFAULT 0,
    committed integer NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT NOW(),
    -- Invariantes Matemáticas Críticas
    CONSTRAINT positive_stock CHECK (on_hand >= 0 AND reserved >= 0 AND committed >= 0),
    CONSTRAINT available_logic CHECK ((on_hand - reserved) >= 0)
);

-- O Ledger (Diário) do Estoque
CREATE TABLE inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_variant_id uuid REFERENCES master_product_variants(id) ON DELETE RESTRICT NOT NULL,
    movement_type inventory_movement_type NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    reference_type text, -- Ex: 'ORDER', 'RESERVATION'
    reference_id uuid,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE store_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    master_product_id uuid REFERENCES master_products(id) ON DELETE RESTRICT NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    seo_data jsonb,
    status text DEFAULT 'DRAFT',
    deleted_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    UNIQUE(store_id, slug)
);

CREATE TABLE store_product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_id uuid REFERENCES store_products(id) ON DELETE CASCADE NOT NULL,
    master_variant_id uuid REFERENCES master_product_variants(id) ON DELETE RESTRICT NOT NULL,
    sale_price numeric(15,2) NOT NULL CHECK (sale_price >= 0),
    compare_at_price numeric(15,2),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- ==========================================
-- 004_COMMERCE: CARTS, CHECKOUT, ORDERS
-- ==========================================
CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT NOT NULL,
    email text NOT NULL,
    document text,
    full_name text,
    deleted_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

CREATE TABLE carts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE RESTRICT NOT NULL,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    status text DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE checkouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id uuid REFERENCES carts(id) ON DELETE RESTRICT NOT NULL,
    store_id uuid REFERENCES stores(id) ON DELETE RESTRICT NOT NULL,
    status text DEFAULT 'IN_PROGRESS',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE inventory_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_variant_id uuid REFERENCES master_product_variants(id) ON DELETE RESTRICT NOT NULL,
    checkout_id uuid REFERENCES checkouts(id) ON DELETE RESTRICT NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    status reservation_status DEFAULT 'ACTIVE',
    expires_at timestamptz NOT NULL,
    released_at timestamptz,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT NOT NULL,
    store_id uuid REFERENCES stores(id) ON DELETE RESTRICT NOT NULL,
    customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
    checkout_id uuid REFERENCES checkouts(id) ON DELETE RESTRICT,
    order_number text UNIQUE NOT NULL, -- Ex: PUB-100001
    status order_status DEFAULT 'PENDING_PAYMENT',
    currency char(3) DEFAULT 'BRL',
    total_amount numeric(15,2) NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    master_variant_id uuid REFERENCES master_product_variants(id) ON DELETE RESTRICT,
    store_product_variant_id uuid REFERENCES store_product_variants(id) ON DELETE SET NULL,
    -- Snapshots imutáveis comerciais
    snapshot_sku text NOT NULL,
    snapshot_name text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    sale_price numeric(15,2) NOT NULL,
    cost_price numeric(15,2) NOT NULL,
    discount numeric(15,2) DEFAULT 0.00,
    pub_margin numeric(15,2) NOT NULL,
    merchant_margin numeric(15,2) NOT NULL,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE order_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid UNIQUE REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    recipient_name text NOT NULL,
    phone text,
    postal_code text NOT NULL,
    street text NOT NULL,
    number text NOT NULL,
    complement text,
    neighborhood text,
    city text NOT NULL,
    state text NOT NULL,
    country text DEFAULT 'BR',
    created_at timestamptz DEFAULT NOW()
);

-- ==========================================
-- 005_FINANCE: PAYMENTS, SPLITS, LEDGER
-- ==========================================
CREATE TABLE financial_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    model_type text NOT NULL,
    config_payload jsonb NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    provider text NOT NULL,
    gross_amount numeric(15,2) NOT NULL,
    net_amount numeric(15,2),
    gateway_fee numeric(15,2),
    currency char(3) DEFAULT 'BRL',
    status payment_status DEFAULT 'PENDING',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid REFERENCES payments(id) ON DELETE RESTRICT NOT NULL,
    provider text NOT NULL,
    transaction_id_external text,
    idempotency_key text NOT NULL,
    type text NOT NULL, -- CAPTURE, REFUND, CHARGEBACK
    amount numeric(15,2) NOT NULL,
    status text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    -- Restrição Crítica de Idempotência
    UNIQUE(provider, idempotency_key)
);

-- Conta Corrente do Lojista
CREATE TABLE merchant_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT NOT NULL,
    currency char(3) DEFAULT 'BRL',
    balance numeric(15,2) DEFAULT 0.00,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE merchant_ledger_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_account_id uuid REFERENCES merchant_accounts(id) ON DELETE RESTRICT NOT NULL,
    entry_type ledger_entry_type NOT NULL,
    amount numeric(15,2) NOT NULL, -- Valores negativos debita
    currency char(3) DEFAULT 'BRL',
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    description text,
    created_at timestamptz DEFAULT NOW()
);

-- ==========================================
-- 006_SHIPPING & FULFILLMENT
-- ==========================================
CREATE TABLE shipping_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    organization_id uuid REFERENCES organizations(id),
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE shipping_quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_id uuid REFERENCES checkouts(id) ON DELETE RESTRICT NOT NULL,
    carrier text NOT NULL,
    service_name text NOT NULL,
    price numeric(15,2) NOT NULL,
    estimated_days integer,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE fulfillments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    provider text NOT NULL,
    status fulfillment_status DEFAULT 'PENDING',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE shipments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_id uuid REFERENCES fulfillments(id) ON DELETE RESTRICT NOT NULL,
    carrier text NOT NULL,
    tracking_code text,
    shipping_cost numeric(15,2),
    status text,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- ==========================================
-- 007_AUDIT: DOMAIN EVENTS E LOGS
-- ==========================================
CREATE TABLE domain_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    provider text,
    idempotency_key text,
    processed_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (provider, idempotency_key)
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz DEFAULT NOW()
);

-- ==========================================
-- 008_FUNCTIONS, TRIGGERS & RLS (SECURITY)
-- ==========================================

-- Trigger de Conta Corrente
CREATE OR REPLACE FUNCTION update_merchant_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE merchant_accounts
    SET balance = balance + NEW.amount, updated_at = NOW()
    WHERE id = NEW.merchant_account_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_merchant_balance
AFTER INSERT ON merchant_ledger_entries
FOR EACH ROW EXECUTE PROCEDURE update_merchant_balance();

-- RPC ATÔMICA: Reserva de Estoque e Registro no Ledger de Estoque (SECURITY DEFINER BLINDADO)
CREATE OR REPLACE FUNCTION reserve_stock_atomic(
    p_master_variant_id uuid,
    p_checkout_id uuid,
    p_quantity integer,
    p_ttl_minutes integer DEFAULT 15
) RETURNS boolean AS $$
DECLARE
    v_updated_id uuid;
BEGIN
    -- Update Condicional no banco (Atomic Lock)
    UPDATE master_inventory
    SET reserved = reserved + p_quantity, updated_at = NOW()
    WHERE master_variant_id = p_master_variant_id 
      AND (on_hand - reserved) >= p_quantity
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NOT NULL THEN
        -- Cria a reserva com expiração
        INSERT INTO inventory_reservations (master_variant_id, checkout_id, quantity, expires_at)
        VALUES (p_master_variant_id, p_checkout_id, p_quantity, NOW() + (p_ttl_minutes || ' minutes')::interval);
        
        -- Regista o movimento (Auditoria)
        INSERT INTO inventory_movements (master_variant_id, movement_type, quantity, reference_type, reference_id)
        VALUES (p_master_variant_id, 'RESERVE', p_quantity, 'CHECKOUT', p_checkout_id);
        
        RETURN true;
    ELSE
        RETURN false; -- Overselling bloqueado
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Habilitação RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_accounts ENABLE ROW LEVEL SECURITY;

-- POLICIES BÁSICAS (Isolamento Multi-Tenant)
CREATE POLICY "org_read_access" ON organizations FOR SELECT USING (id IN (SELECT get_user_organizations()));
CREATE POLICY "store_read_access" ON stores FOR SELECT USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "store_products_tenant_all" ON store_products FOR ALL USING (store_id IN (SELECT id FROM stores WHERE organization_id IN (SELECT get_user_organizations())));
CREATE POLICY "store_products_public_read" ON store_products FOR SELECT USING (status = 'PUBLISHED' AND deleted_at IS NULL);
CREATE POLICY "orders_tenant_all" ON orders FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "ledger_tenant_read" ON merchant_accounts FOR SELECT USING (organization_id IN (SELECT get_user_organizations()));