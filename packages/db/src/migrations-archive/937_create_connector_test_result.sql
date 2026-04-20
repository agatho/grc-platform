-- Sprint 62: Evidence Connector Framework
-- Migration 937: Create connector_test_result table

CREATE TABLE IF NOT EXISTS connector_test_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  test_definition_id UUID NOT NULL REFERENCES connector_test_definition(id),
  schedule_id UUID REFERENCES connector_schedule(id),
  status VARCHAR(20) NOT NULL,
  result JSONB DEFAULT '{}',
  findings JSONB DEFAULT '[]',
  resources_scanned INT NOT NULL DEFAULT 0,
  resources_failed INT NOT NULL DEFAULT 0,
  duration_ms INT,
  artifact_ids JSONB DEFAULT '[]',
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ctr_connector_idx ON connector_test_result(connector_id);
CREATE INDEX ctr_test_def_idx ON connector_test_result(test_definition_id);
CREATE INDEX ctr_org_idx ON connector_test_result(org_id);
CREATE INDEX ctr_status_idx ON connector_test_result(status);
CREATE INDEX ctr_executed_idx ON connector_test_result(executed_at);
CREATE INDEX ctr_schedule_idx ON connector_test_result(schedule_id);

-- RLS
ALTER TABLE connector_test_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_test_result_org_isolation ON connector_test_result
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER connector_test_result_audit AFTER INSERT OR UPDATE OR DELETE ON connector_test_result
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
