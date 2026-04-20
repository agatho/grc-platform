-- Sprint 57: Developer Applications (OAuth2)
-- Migration 894: Create developer_app table

CREATE TABLE IF NOT EXISTS developer_app (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_id VARCHAR(64) NOT NULL UNIQUE,
  client_secret_hash VARCHAR(512) NOT NULL,
  client_secret_last4 VARCHAR(4) NOT NULL,
  redirect_uris JSONB DEFAULT '[]',
  grant_types JSONB DEFAULT '["authorization_code"]',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  logo_url VARCHAR(500),
  homepage_url VARCHAR(500),
  privacy_url VARCHAR(500),
  tos_url VARCHAR(500),
  created_by UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dev_app_org_idx ON developer_app(org_id);
CREATE INDEX dev_app_status_idx ON developer_app(org_id, status);
CREATE UNIQUE INDEX dev_app_client_id_idx ON developer_app(client_id);

-- RLS
ALTER TABLE developer_app ENABLE ROW LEVEL SECURITY;
CREATE POLICY developer_app_org_isolation ON developer_app
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Audit trigger
CREATE TRIGGER developer_app_audit AFTER INSERT OR UPDATE OR DELETE ON developer_app
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
