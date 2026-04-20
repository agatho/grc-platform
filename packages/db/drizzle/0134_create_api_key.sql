-- Sprint 57: API Key Management
-- Migration 891: Create api_key table

CREATE TABLE IF NOT EXISTS api_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  key_prefix VARCHAR(12) NOT NULL,
  key_hash VARCHAR(512) NOT NULL,
  key_last4 VARCHAR(4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  rate_limit_per_minute INT NOT NULL DEFAULT 60,
  rate_limit_per_day INT NOT NULL DEFAULT 10000,
  allowed_ips JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES "user"(id)
);

CREATE INDEX api_key_org_idx ON api_key(org_id);
CREATE INDEX api_key_status_idx ON api_key(org_id, status);
CREATE UNIQUE INDEX api_key_prefix_idx ON api_key(key_prefix);
CREATE INDEX api_key_created_by_idx ON api_key(created_by);

-- RLS
ALTER TABLE api_key ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_key_org_isolation ON api_key
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Audit trigger
CREATE TRIGGER api_key_audit AFTER INSERT OR UPDATE OR DELETE ON api_key
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
