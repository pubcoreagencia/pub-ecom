-- 00005_ORDERS_SHIPPING
CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Composite FK para Tenant Integrity (impede ordem na store de outra org)
    organization_id uuid NOT NULL,
    store_id uuid NOT NULL,
    FOREIGN KEY (store_id, organization_id) REFERENCES stores(id, organization_id) ON DELETE RESTRICT,
    -- Composite FK para proteger a Customer
    customer_id uuid NOT NULL,
    FOREIGN KEY (customer_id, organization_id) REFERENCES customers(id, organization_id) ON DELETE RESTRICT,
    checkout_id uuid REFERENCES checkouts(id) ON DELETE RESTRICT,
    order_number text UNIQUE NOT NULL,
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

CREATE TABLE order_shipping_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    carrier text NOT NULL,
    service_name text NOT NULL,
    charged_shipping_cost numeric(15,2) NOT NULL,
    actual_shipping_cost numeric(15,2),
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
    status text, -- Text by architecture design
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);
