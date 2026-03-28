-- Sprint 62: Evidence Connector Framework
-- Migration 932: Create connector_credential table

CREATE TABLE IF NOT EXISTS connector_credential (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  credential_type VARCHAR(30) NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv VARCHAR(64) NOT NULL,
  auth_tag VARCHAR(64) NOT NULL,
  key_version INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  refresh_token TEXT,
  scopes JSONB DEFAULT '[]',
  last_rotated_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ccred_connector_idx ON connector_credential(connector_id);
CREATE INDEX ccred_org_idx ON connector_credential(org_id);
CREATE INDEX ccred_expiry_idx ON connector_credential(expires_at);

-- RLS
ALTER TABLE connector_credential ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_credential_org_isolation ON connector_credential
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER connector_credential_audit AFTER INSERT OR UPDATE OR DELETE ON connector_credential
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
