-- Sprint 65: DevOps und IT Connectors
-- Migration 951: Create devops_connector_config table

CREATE TABLE IF NOT EXISTS devops_connector_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  platform_category VARCHAR(30) NOT NULL,
  branch_protection_check BOOLEAN NOT NULL DEFAULT true,
  code_review_check BOOLEAN NOT NULL DEFAULT true,
  sast_enabled BOOLEAN NOT NULL DEFAULT true,
  secret_scanning_check BOOLEAN NOT NULL DEFAULT true,
  sla_compliance_check BOOLEAN NOT NULL DEFAULT true,
  docs_freshness_check BOOLEAN NOT NULL DEFAULT true,
  docs_freshness_max_days INT NOT NULL DEFAULT 180,
  endpoint_compliance_check BOOLEAN NOT NULL DEFAULT false,
  firewall_rule_check BOOLEAN NOT NULL DEFAULT false,
  repositories JSONB DEFAULT '[]',
  projects JSONB DEFAULT '[]',
  spaces JSONB DEFAULT '[]',
  config JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dcc_org_idx ON devops_connector_config(org_id);
CREATE INDEX dcc_connector_idx ON devops_connector_config(connector_id);
CREATE INDEX dcc_platform_idx ON devops_connector_config(platform);
CREATE INDEX dcc_category_idx ON devops_connector_config(platform_category);

-- RLS
ALTER TABLE devops_connector_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY devops_connector_config_org_isolation ON devops_connector_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER devops_connector_config_audit AFTER INSERT OR UPDATE OR DELETE ON devops_connector_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
