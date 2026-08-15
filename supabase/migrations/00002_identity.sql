-- 00002_IDENTITY: USERS, ORGS, STORES
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
    status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
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
    status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    -- CHAVE COMPOSTA PARA ISOLAMENTO TENANT EM DESCENDENTES
    UNIQUE(id, organization_id)
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
