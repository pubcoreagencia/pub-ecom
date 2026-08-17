-- Migration 00010: Media Security

-- 1. Add Ownership Boundary
ALTER TABLE media_assets ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_media_assets_org_id ON media_assets(organization_id);

-- 2. Drop old insecure policies
DROP POLICY IF EXISTS "media_assets_sel_pub" ON media_assets;
DROP POLICY IF EXISTS "media_assets_ins_auth" ON media_assets;
DROP POLICY IF EXISTS "mpm_sel_pub" ON master_product_media;
DROP POLICY IF EXISTS "sm_sel_pub" ON store_media;
DROP POLICY IF EXISTS "sm_ins_auth" ON store_media;
DROP POLICY IF EXISTS "sm_upd_auth" ON store_media;
DROP POLICY IF EXISTS "sm_del_auth" ON store_media;

-- 3. Create Security Definer Helpers for RLS
CREATE OR REPLACE FUNCTION is_store_active(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM stores WHERE id = p_store_id AND status = 'ACTIVE'
    );
$$;

CREATE OR REPLACE FUNCTION is_master_product_published(p_master_product_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM store_products 
        WHERE master_product_id = p_master_product_id 
          AND status = 'PUBLISHED' 
          AND deleted_at IS NULL
    );
$$;

-- 4. Define New RLS Policies

-- media_assets
-- A. Public SELECT: Anonymously readable only if linked to a published store_product OR an active store
CREATE POLICY "media_assets_sel_pub" ON media_assets FOR SELECT TO PUBLIC USING (
    EXISTS (
        SELECT 1 FROM master_product_media mpm
        WHERE mpm.media_asset_id = media_assets.id
          AND is_master_product_published(mpm.master_product_id)
    )
    OR
    EXISTS (
        SELECT 1 FROM store_media sm
        WHERE sm.media_asset_id = media_assets.id
          AND is_store_active(sm.store_id)
    )
);

-- B. Tenant SELECT: Authenticated user can read assets of their own organization
CREATE POLICY "media_assets_sel_auth" ON media_assets FOR SELECT TO authenticated USING (
    organization_id IS NOT NULL AND has_org_role(organization_id, 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')
);

-- C. Tenant INSERT/UPDATE/DELETE
CREATE POLICY "media_assets_ins_auth" ON media_assets FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NOT NULL AND has_org_role(organization_id, 'OWNER', 'ADMIN', 'OPERATOR')
);
CREATE POLICY "media_assets_upd_auth" ON media_assets FOR UPDATE TO authenticated USING (
    organization_id IS NOT NULL AND has_org_role(organization_id, 'OWNER', 'ADMIN', 'OPERATOR')
) WITH CHECK (
    organization_id IS NOT NULL AND has_org_role(organization_id, 'OWNER', 'ADMIN', 'OPERATOR')
);
CREATE POLICY "media_assets_del_auth" ON media_assets FOR DELETE TO authenticated USING (
    organization_id IS NOT NULL AND has_org_role(organization_id, 'OWNER', 'ADMIN', 'OPERATOR')
);

-- master_product_media
-- A. Public SELECT
CREATE POLICY "mpm_sel_pub" ON master_product_media FOR SELECT TO PUBLIC USING (
    is_master_product_published(master_product_id)
);

-- store_media
-- A. Public SELECT
CREATE POLICY "sm_sel_pub" ON store_media FOR SELECT TO PUBLIC USING (
    is_store_active(store_id)
);
-- B. Tenant SELECT
CREATE POLICY "sm_sel_auth" ON store_media FOR SELECT TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = store_media.store_id), 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')
);
-- C. Tenant Mutability
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

-- 5. Grants for Anonymous Access
GRANT SELECT ON media_assets TO anon;
GRANT SELECT ON master_product_media TO anon;
GRANT SELECT ON store_media TO anon;
