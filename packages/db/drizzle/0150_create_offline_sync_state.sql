-- Sprint 60: Offline Sync
-- Migration 918: Create offline_sync_state and mobile_session tables

CREATE TABLE IF NOT EXISTS offline_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  device_id UUID NOT NULL REFERENCES device_registration(id),
  entity_type VARCHAR(50) NOT NULL,
  last_synced_at TIMESTAMPTZ,
  sync_version INT NOT NULL DEFAULT 0,
  pending_changes JSONB DEFAULT '[]',
  conflict_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'synced',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX offline_sync_org_idx ON offline_sync_state(org_id);
CREATE UNIQUE INDEX offline_sync_unique_idx ON offline_sync_state(device_id, entity_type);
CREATE INDEX offline_sync_user_idx ON offline_sync_state(user_id);

-- RLS
ALTER TABLE offline_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY offline_sync_state_org_isolation ON offline_sync_state
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE TABLE IF NOT EXISTS mobile_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  device_id UUID NOT NULL REFERENCES device_registration(id),
  refresh_token_hash VARCHAR(512) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity_at TIMESTAMPTZ,
  ip_address VARCHAR(45),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mobile_session_org_idx ON mobile_session(org_id);
CREATE INDEX mobile_session_user_idx ON mobile_session(user_id);
CREATE INDEX mobile_session_device_idx ON mobile_session(device_id);
CREATE INDEX mobile_session_active_idx ON mobile_session(user_id, is_active);

-- RLS
ALTER TABLE mobile_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY mobile_session_org_isolation ON mobile_session
  USING (org_id::text = current_setting('app.current_org_id', true));
