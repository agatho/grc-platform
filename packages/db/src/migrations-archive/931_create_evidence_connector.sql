-- Sprint 62: Evidence Connector Framework
-- Migration 931: Create evidence_connector table

CREATE TABLE IF NOT EXISTS evidence_connector (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  connector_type VARCHAR(50) NOT NULL,
  provider_key VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  status VARCHAR(30) NOT NULL DEFAULT 'inactive',
  auth_method VARCHAR(30) NOT NULL,
  base_url VARCHAR(1000),
  config JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '[]',
  last_health_check TIMESTAMPTZ,
  health_status VARCHAR(20) DEFAULT 'unknown',
  error_message TEXT,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX ec_org_idx ON evidence_connector(org_id);
CREATE INDEX ec_type_idx ON evidence_connector(connector_type);
CREATE INDEX ec_status_idx ON evidence_connector(org_id, status);
CREATE INDEX ec_provider_idx ON evidence_connector(provider_key);

-- RLS
ALTER TABLE evidence_connector ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_connector_org_isolation ON evidence_connector
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER evidence_connector_audit AFTER INSERT OR UPDATE OR DELETE ON evidence_connector
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
