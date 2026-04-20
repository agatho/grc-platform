-- Sprint 70: AI Control Testing Agent
-- Migration 980: Create control_test_execution table

CREATE TABLE IF NOT EXISTS control_test_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES control_test_script(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  control_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result VARCHAR(20),
  result_severity VARCHAR(20),
  step_results JSONB DEFAULT '[]',
  summary TEXT,
  ai_analysis TEXT,
  findings_generated INT NOT NULL DEFAULT 0,
  finding_ids JSONB DEFAULT '[]',
  connector_logs JSONB DEFAULT '[]',
  duration_ms INT,
  tokens_used INT NOT NULL DEFAULT 0,
  executed_by UUID REFERENCES "user"(id),
  triggered_by VARCHAR(20) NOT NULL DEFAULT 'manual',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX control_test_execution_script_idx ON control_test_execution(script_id);
CREATE INDEX control_test_execution_org_idx ON control_test_execution(org_id);
CREATE INDEX control_test_execution_control_idx ON control_test_execution(org_id, control_id);
CREATE INDEX control_test_execution_status_idx ON control_test_execution(org_id, status);
CREATE INDEX control_test_execution_date_idx ON control_test_execution(org_id, created_at);

ALTER TABLE control_test_execution ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_test_execution_org_isolation ON control_test_execution
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER control_test_execution_audit
  AFTER INSERT OR UPDATE OR DELETE ON control_test_execution
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
