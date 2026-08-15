-- 00004_COMMERCE: CARTS, CHECKOUT, ORDERS
CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT NOT NULL,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL, -- Identidade primária (NULL para guest)
    email text NOT NULL,
    document text,
    full_name text,
    deleted_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    -- Impedir mesmo usuário em duplicidade na mesma org, mas aceitar guests múltiplos
    UNIQUE NULLS NOT DISTINCT (organization_id, user_id),
    -- UNIQUE constraint para suportar Composite FK em descencentes
    UNIQUE(id, organization_id)
);

CREATE TABLE carts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE RESTRICT NOT NULL,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    guest_token_hash text, -- Criptografia do token de guest
    token_expires_at timestamptz,
    status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    -- UNIQUE constraint para suportar Composite FK no checkout
    UNIQUE(id, store_id)
);

CREATE TABLE checkouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Composite FK forçando que a loja do checkout seja a mesma do carrinho
    cart_id uuid NOT NULL,
    store_id uuid NOT NULL,
    FOREIGN KEY (cart_id, store_id) REFERENCES carts(id, store_id) ON DELETE RESTRICT,
    status text DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED')),
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
