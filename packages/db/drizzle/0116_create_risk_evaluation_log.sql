-- Sprint 54, Migration 844: Create risk_evaluation_log table with RLS

CREATE TABLE IF NOT EXISTS risk_evaluation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organization(id),
  old_phase VARCHAR(20),
  new_phase VARCHAR(20) NOT NULL,
  transitioned_by UUID REFERENCES "user"(id),
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rel_risk_idx ON risk_evaluation_log (risk_id);
CREATE INDEX IF NOT EXISTS rel_org_idx ON risk_evaluation_log (org_id);

ALTER TABLE risk_evaluation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_evaluation_log_org_isolation ON risk_evaluation_log;
CREATE POLICY risk_evaluation_log_org_isolation ON risk_evaluation_log
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Register audit trigger
DROP TRIGGER IF EXISTS risk_evaluation_log_audit ON risk_evaluation_log;
CREATE TRIGGER risk_evaluation_log_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_evaluation_log
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
