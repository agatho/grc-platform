-- Sprint 70: AI Control Testing Agent
-- Migration 979: Create control_test_script table

CREATE TABLE IF NOT EXISTS control_test_script (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  control_id UUID NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  test_type VARCHAR(50) NOT NULL,
  script_content TEXT NOT NULL,
  steps JSONB DEFAULT '[]',
  connector_type VARCHAR(50),
  connector_config JSONB DEFAULT '{}',
  frequency VARCHAR(20),
  expected_duration_minutes INT,
  severity_mapping JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  ai_generated BOOLEAN NOT NULL DEFAULT true,
  ai_model VARCHAR(100),
  ai_confidence NUMERIC(5,2),
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cts_org_idx ON control_test_script(org_id);
CREATE INDEX cts_control_idx ON control_test_script(org_id, control_id);
CREATE INDEX cts_type_idx ON control_test_script(org_id, test_type);
CREATE INDEX cts_active_idx ON control_test_script(org_id, is_active);

ALTER TABLE control_test_script ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_test_script_org_isolation ON control_test_script
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER control_test_script_audit
  AFTER INSERT OR UPDATE OR DELETE ON control_test_script
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
