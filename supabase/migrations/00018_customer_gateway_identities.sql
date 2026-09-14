-- Migration 00018: Customer Gateway Identities (External Customer Mapping)
-- -----------------------------------------------------------
-- 1. Table definition
CREATE TABLE public.customer_gateway_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    connection_id uuid NOT NULL REFERENCES public.gateway_connections(id) ON DELETE RESTRICT,
    external_customer_id text NULL,
    status text NOT NULL CHECK (
        status IN ('PENDING','ACTIVE','FAILED')
    ),
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Cardinality constraints
    CONSTRAINT uq_cg_identity_customer_connection UNIQUE (customer_id, connection_id),
    CONSTRAINT uq_cg_identity_connection_external UNIQUE (connection_id, external_customer_id)
);

-- 2. State validity CHECK (allow NULL external_customer_id only for PENDING)
ALTER TABLE public.customer_gateway_identities
    ADD CONSTRAINT ck_cg_identity_status_external CHECK (
        (status = 'PENDING' AND external_customer_id IS NULL) OR
        (status = 'ACTIVE' AND external_customer_id IS NOT NULL) OR
        (status = 'FAILED')
    );

-- 3. Timestamp trigger (reuse existing trigger_set_timestamp() function if present)
CREATE TRIGGER set_timestamp_cgi
    BEFORE UPDATE ON public.customer_gateway_identities
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- 4. Enable Row Level Security
ALTER TABLE public.customer_gateway_identities ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- A. Authenticated customers can read/write their own identities
CREATE POLICY "cgi_auth_all" ON public.customer_gateway_identities
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_gateway_identities.customer_id
          AND (c.user_id = auth.uid() OR has_org_role(c.organization_id, 'OWNER', 'ADMIN', 'OPERATOR'))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_gateway_identities.customer_id
          AND (c.user_id = auth.uid() OR has_org_role(c.organization_id, 'OWNER', 'ADMIN', 'OPERATOR'))
    )
);

-- B. Org operators can read identities for any customer in the org (no write)
CREATE POLICY "cgi_org_read" ON public.customer_gateway_identities
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_gateway_identities.customer_id
          AND has_org_role(c.organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')
    )
);

-- 6. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_gateway_identities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_gateway_identities TO authenticated;
