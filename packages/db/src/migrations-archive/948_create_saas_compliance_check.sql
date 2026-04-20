-- Sprint 64: Identity und SaaS Connectors
-- Migration 948: Create saas_compliance_check table

CREATE TABLE IF NOT EXISTS saas_compliance_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  check_type VARCHAR(50) NOT NULL,
  check_name VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  details JSONB DEFAULT '{}',
  findings JSONB DEFAULT '[]',
  affected_resources INT NOT NULL DEFAULT 0,
  total_resources INT NOT NULL DEFAULT 0,
  compliance_rate NUMERIC(5,2),
  remediation_guide TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scc_org_idx ON saas_compliance_check(org_id);
CREATE INDEX scc_connector_idx ON saas_compliance_check(connector_id);
CREATE INDEX scc_platform_idx ON saas_compliance_check(platform);
CREATE INDEX scc_check_type_idx ON saas_compliance_check(check_type);
CREATE INDEX scc_status_idx ON saas_compliance_check(status);
CREATE INDEX scc_executed_idx ON saas_compliance_check(executed_at);

-- RLS
ALTER TABLE saas_compliance_check ENABLE ROW LEVEL SECURITY;
CREATE POLICY saas_compliance_check_org_isolation ON saas_compliance_check
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER saas_compliance_check_audit AFTER INSERT OR UPDATE OR DELETE ON saas_compliance_check
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
