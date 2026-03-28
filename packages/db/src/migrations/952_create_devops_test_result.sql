-- Sprint 65: DevOps und IT Connectors
-- Migration 952: Create devops_test_result table

CREATE TABLE IF NOT EXISTS devops_test_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES devops_connector_config(id),
  test_category VARCHAR(50) NOT NULL,
  test_name VARCHAR(500) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_name VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  details JSONB DEFAULT '{}',
  findings JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  compliance_rate NUMERIC(5,2),
  remediation_steps TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dtr_org_idx ON devops_test_result(org_id);
CREATE INDEX dtr_connector_idx ON devops_test_result(connector_id);
CREATE INDEX dtr_config_idx ON devops_test_result(config_id);
CREATE INDEX dtr_category_idx ON devops_test_result(test_category);
CREATE INDEX dtr_status_idx ON devops_test_result(status);
CREATE INDEX dtr_executed_idx ON devops_test_result(executed_at);

-- RLS
ALTER TABLE devops_test_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY devops_test_result_org_isolation ON devops_test_result
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER devops_test_result_audit AFTER INSERT OR UPDATE OR DELETE ON devops_test_result
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
