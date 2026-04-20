-- Sprint 62: Evidence Connector Framework
-- Migration 938: Create evidence_freshness_config table

CREATE TABLE IF NOT EXISTS evidence_freshness_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  connector_id UUID REFERENCES evidence_connector(id),
  test_key VARCHAR(100),
  max_age_days INT NOT NULL DEFAULT 30,
  warning_days INT NOT NULL DEFAULT 7,
  auto_collect BOOLEAN NOT NULL DEFAULT true,
  notify_on_stale BOOLEAN NOT NULL DEFAULT true,
  notify_roles JSONB DEFAULT '["control_owner", "risk_manager"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX efc_org_idx ON evidence_freshness_config(org_id);
CREATE INDEX efc_entity_idx ON evidence_freshness_config(entity_type, entity_id);
CREATE INDEX efc_connector_idx ON evidence_freshness_config(connector_id);

-- RLS
ALTER TABLE evidence_freshness_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_freshness_config_org_isolation ON evidence_freshness_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER evidence_freshness_config_audit AFTER INSERT OR UPDATE OR DELETE ON evidence_freshness_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
