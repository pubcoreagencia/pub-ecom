-- Migration 00011: Tracking and Analytics Foundation

-- 1. Create Event Types
CREATE TYPE tracking_event_type AS ENUM ('page_view', 'product_view', 'add_to_cart', 'click');

-- 2. Create tracking_sessions
CREATE TABLE tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    referrer TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create tracking_events
CREATE TABLE tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    event_type tracking_event_type NOT NULL,
    url TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Enforce Session/Event Store Consistency
-- Creates a structural guarantee that an event's store_id perfectly matches its parent session's store_id
ALTER TABLE tracking_sessions ADD CONSTRAINT uq_tracking_session_store UNIQUE (id, store_id);
ALTER TABLE tracking_events ADD CONSTRAINT fk_tracking_event_session 
    FOREIGN KEY (session_id, store_id) REFERENCES tracking_sessions (id, store_id) ON DELETE CASCADE;

-- 5. Indexes
CREATE INDEX idx_tracking_sessions_store_id ON tracking_sessions(store_id);
CREATE INDEX idx_tracking_sessions_visitor_id ON tracking_sessions(visitor_id);
CREATE INDEX idx_tracking_sessions_started_at ON tracking_sessions(started_at);

CREATE INDEX idx_tracking_events_session_id ON tracking_events(session_id);
CREATE INDEX idx_tracking_events_store_id ON tracking_events(store_id);
CREATE INDEX idx_tracking_events_created_at ON tracking_events(created_at);

-- 6. Immutability Triggers (Prevent Timestamp Spoofing)
CREATE OR REPLACE FUNCTION force_tracking_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_TABLE_NAME = 'tracking_sessions' THEN
        NEW.started_at = NOW();
    ELSIF TG_TABLE_NAME = 'tracking_events' THEN
        NEW.created_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_force_ts_sessions 
    BEFORE INSERT ON tracking_sessions 
    FOR EACH ROW EXECUTE PROCEDURE force_tracking_timestamp();

CREATE TRIGGER trg_force_ts_events 
    BEFORE INSERT ON tracking_events 
    FOR EACH ROW EXECUTE PROCEDURE force_tracking_timestamp();

-- 7. Enable RLS
ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- 8. Define RLS Policies

-- tracking_sessions
-- A. Public Ingestion (Anon can INSERT only if store is ACTIVE)
CREATE POLICY "ts_ins_anon" ON tracking_sessions FOR INSERT TO anon WITH CHECK (
    is_store_active(store_id)
);
-- B. Tenant Analytics (Authenticated can SELECT their own store's sessions)
CREATE POLICY "ts_sel_auth" ON tracking_sessions FOR SELECT TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = tracking_sessions.store_id), 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')
);

-- tracking_events
-- A. Public Ingestion (Anon can INSERT only if store is ACTIVE)
CREATE POLICY "te_ins_anon" ON tracking_events FOR INSERT TO anon WITH CHECK (
    is_store_active(store_id)
);
-- B. Tenant Analytics (Authenticated can SELECT their own store's events)
CREATE POLICY "te_sel_auth" ON tracking_events FOR SELECT TO authenticated USING (
    has_org_role((SELECT organization_id FROM stores WHERE stores.id = tracking_events.store_id), 'OWNER', 'ADMIN', 'FINANCE', 'OPERATOR')
);

-- Note: UPDATE and DELETE are completely omitted for anon and authenticated, 
-- ensuring append-only persistence at the RLS level. 
-- Service_role implicitly bypasses RLS for system-level maintenance.

-- 9. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON tracking_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON tracking_events TO authenticated, service_role;

-- Grant strictly INSERT to anon. Deny SELECT, UPDATE, DELETE.
GRANT INSERT ON tracking_sessions TO anon;
GRANT INSERT ON tracking_events TO anon;
