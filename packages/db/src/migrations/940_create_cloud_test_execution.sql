-- Sprint 63: Cloud Infrastructure Connectors
-- Migration 940: Create cloud_test_execution table

CREATE TABLE IF NOT EXISTS cloud_test_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  suite_id UUID NOT NULL REFERENCES cloud_test_suite(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES evidence_connector(id),
  provider VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  total_tests INT NOT NULL DEFAULT 0,
  pass_count INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  skip_count INT NOT NULL DEFAULT 0,
  pass_rate NUMERIC(5,2),
  duration_ms INT,
  results JSONB DEFAULT '[]',
  triggered_by VARCHAR(30) NOT NULL DEFAULT 'schedule',
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cte_org_idx ON cloud_test_execution(org_id);
CREATE INDEX cte_suite_idx ON cloud_test_execution(suite_id);
CREATE INDEX cte_connector_idx ON cloud_test_execution(connector_id);
CREATE INDEX cte_status_idx ON cloud_test_execution(status);
CREATE INDEX cte_started_idx ON cloud_test_execution(started_at);

-- RLS
ALTER TABLE cloud_test_execution ENABLE ROW LEVEL SECURITY;
CREATE POLICY cloud_test_execution_org_isolation ON cloud_test_execution
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER cloud_test_execution_audit AFTER INSERT OR UPDATE OR DELETE ON cloud_test_execution
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
