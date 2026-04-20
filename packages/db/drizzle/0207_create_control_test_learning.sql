-- Sprint 70: AI Control Testing Agent
-- Migration 982: Create control_test_learning table

CREATE TABLE IF NOT EXISTS control_test_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  control_id UUID NOT NULL,
  pattern_type VARCHAR(50) NOT NULL,
  pattern JSONB NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  sample_size INT NOT NULL DEFAULT 0,
  last_updated_from_execution UUID,
  is_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ctl_org_idx ON control_test_learning(org_id);
CREATE INDEX ctl_control_idx ON control_test_learning(org_id, control_id);
CREATE INDEX ctl_pattern_idx ON control_test_learning(org_id, pattern_type);

ALTER TABLE control_test_learning ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_test_learning_org_isolation ON control_test_learning
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER control_test_learning_audit
  AFTER INSERT OR UPDATE OR DELETE ON control_test_learning
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
