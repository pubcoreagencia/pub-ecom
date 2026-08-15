-- 00003_CATALOG & INVENTORY
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
    status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
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
    -- Invariantes Matemáticas Críticas Revisadas
    CONSTRAINT positive_stock CHECK (on_hand >= 0 AND reserved >= 0 AND committed >= 0),
    CONSTRAINT available_logic CHECK ((on_hand - reserved - committed) >= 0)
);

CREATE TABLE inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_variant_id uuid REFERENCES master_product_variants(id) ON DELETE RESTRICT NOT NULL,
    movement_type inventory_movement_type NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    -- reference_type/id obrigatórios condicionalmente
    reference_type text, -- Ex: 'ORDER_ITEM', 'RESERVATION'
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
    status text DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
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
