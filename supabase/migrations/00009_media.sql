-- Migration 00009: Media Platform Persistence

-- 1. Create Enums
CREATE TYPE media_asset_type AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE media_source_type AS ENUM ('UPLOAD', 'EXTERNAL', 'MARKETPLACE', 'GENERATED');
CREATE TYPE store_media_purpose AS ENUM ('LOGO', 'FAVICON', 'BANNER', 'PROMOTIONAL');

-- 2. Create media_assets
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type media_asset_type NOT NULL,
    source_type media_source_type NOT NULL,
    storage_path TEXT,
    external_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_media_path_or_url CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)
);

-- 3. Create master_product_media
CREATE TABLE master_product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_product_id UUID NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    position INT DEFAULT 0 NOT NULL,
    is_primary BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (master_product_id, media_asset_id)
);

-- 4. Create store_media
CREATE TABLE store_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    purpose store_media_purpose NOT NULL,
    position INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (store_id, media_asset_id, purpose)
);

-- 5. Enable RLS
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_media ENABLE ROW LEVEL SECURITY;

-- 6. Define RLS Policies

-- media_assets (Read-only for public, Insert for authenticated to allow uploads, Update/Delete locked to Service Role or Creator via application logic. For now, Insert for Auth, Select for Public).
CREATE POLICY "media_assets_sel_pub" ON media_assets FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "media_assets_ins_auth" ON media_assets FOR INSERT TO authenticated WITH CHECK (true);

-- master_product_media (Central Catalog)
CREATE POLICY "mpm_sel_pub" ON master_product_media FOR SELECT TO PUBLIC USING (true);
-- Mutações do master catalog ficam restritas ao Platform Operator via service_role

-- store_media (Store context)
CREATE POLICY "sm_sel_pub" ON store_media FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "sm_ins_auth" ON store_media FOR INSERT TO authenticated WITH CHECK (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_media.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);
CREATE POLICY "sm_upd_auth" ON store_media FOR UPDATE TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_media.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
) WITH CHECK (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_media.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);
CREATE POLICY "sm_del_auth" ON store_media FOR DELETE TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_media.store_id), 'OWNER', 'ADMIN', 'OPERATOR')
);

-- 7. Constraints & Indexes
-- Apenas uma mídia primária por produto master
CREATE UNIQUE INDEX idx_mpm_primary_media ON master_product_media(master_product_id) WHERE is_primary = true;
-- Apenas um LOGO ou FAVICON por loja
CREATE UNIQUE INDEX idx_sm_unique_logo ON store_media(store_id) WHERE purpose = 'LOGO';
CREATE UNIQUE INDEX idx_sm_unique_favicon ON store_media(store_id) WHERE purpose = 'FAVICON';

CREATE INDEX idx_mpm_product_id ON master_product_media(master_product_id);
CREATE INDEX idx_sm_store_id ON store_media(store_id);

-- 8. Updated At Triggers
CREATE TRIGGER set_timestamp_media_assets BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- 9. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON media_assets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON master_product_media TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON store_media TO authenticated, service_role;
