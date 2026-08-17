-- Migration 00008: Store Platform Persistence

-- 1. Create Enums
CREATE TYPE store_template_type AS ENUM ('STORE', 'HOME', 'COLLECTION', 'PRODUCT', 'SALES_PAGE');

-- 2. Create store_settings
CREATE TABLE store_settings (
    store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    identity JSONB DEFAULT '{}'::jsonb NOT NULL,
    design JSONB DEFAULT '{}'::jsonb NOT NULL,
    commerce JSONB DEFAULT '{}'::jsonb NOT NULL,
    marketing JSONB DEFAULT '{}'::jsonb NOT NULL,
    tracking JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create store_templates (Immutable Definition)
CREATE TABLE store_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type store_template_type NOT NULL,
    structure JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Create store_template_configs (Store-Specific Configuration)
CREATE TABLE store_template_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES store_templates(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT false NOT NULL,
    content_bindings JSONB DEFAULT '{}'::jsonb NOT NULL,
    style_tokens JSONB DEFAULT '{}'::jsonb NOT NULL,
    commerce_bindings JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Enable RLS
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_template_configs ENABLE ROW LEVEL SECURITY;

-- 6. Define RLS Policies

-- store_settings
CREATE POLICY "sts_sel_pub" ON store_settings FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "sts_ins_auth" ON store_settings FOR INSERT TO authenticated WITH CHECK (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_settings.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);
CREATE POLICY "sts_upd_auth" ON store_settings FOR UPDATE TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_settings.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
) WITH CHECK (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_settings.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);
CREATE POLICY "sts_del_auth" ON store_settings FOR DELETE TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_settings.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);

-- store_templates
CREATE POLICY "stt_sel_pub" ON store_templates FOR SELECT TO PUBLIC USING (true);
-- Modificacoes apenas via service_role (sem policy explicita de INSERT/UPDATE)

-- store_template_configs
CREATE POLICY "stc_sel_pub" ON store_template_configs FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "stc_ins_auth" ON store_template_configs FOR INSERT TO authenticated WITH CHECK (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_template_configs.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);
CREATE POLICY "stc_upd_auth" ON store_template_configs FOR UPDATE TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_template_configs.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
) WITH CHECK (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_template_configs.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);
CREATE POLICY "stc_del_auth" ON store_template_configs FOR DELETE TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_template_configs.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);

-- 7. Constraints & Indexes
CREATE UNIQUE INDEX idx_store_templates_name_type ON store_templates(name, type);
CREATE INDEX idx_store_template_configs_store_id ON store_template_configs(store_id);
CREATE UNIQUE INDEX idx_stc_active_template ON store_template_configs(store_id, template_id) WHERE is_active = true;

-- 8. Updated At Triggers
CREATE TRIGGER set_timestamp_store_settings BEFORE UPDATE ON store_settings FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_store_templates BEFORE UPDATE ON store_templates FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_store_template_configs BEFORE UPDATE ON store_template_configs FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
