-- Sprint 64: Identity und SaaS Connectors
-- Migration 947: Create identity_test_result table

CREATE TABLE IF NOT EXISTS identity_test_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES identity_connector_config(id),
  test_category VARCHAR(50) NOT NULL,
  test_name VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  total_users INT NOT NULL DEFAULT 0,
  compliant_users INT NOT NULL DEFAULT 0,
  non_compliant_users INT NOT NULL DEFAULT 0,
  compliance_rate NUMERIC(5,2),
  findings JSONB DEFAULT '[]',
  evidence JSONB DEFAULT '{}',
  remediation_steps TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX itr_org_idx ON identity_test_result(org_id);
CREATE INDEX itr_connector_idx ON identity_test_result(connector_id);
CREATE INDEX itr_config_idx ON identity_test_result(config_id);
CREATE INDEX itr_category_idx ON identity_test_result(test_category);
CREATE INDEX itr_status_idx ON identity_test_result(status);
CREATE INDEX itr_executed_idx ON identity_test_result(executed_at);

-- RLS
ALTER TABLE identity_test_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY identity_test_result_org_isolation ON identity_test_result
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER identity_test_result_audit AFTER INSERT OR UPDATE OR DELETE ON identity_test_result
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
