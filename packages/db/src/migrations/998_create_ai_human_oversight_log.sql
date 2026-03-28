-- Sprint 73: EU AI Act Governance Module
-- Migration 998: Create ai_human_oversight_log table

CREATE TABLE IF NOT EXISTS ai_human_oversight_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id) ON DELETE CASCADE,
  log_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  ai_decision TEXT,
  human_decision TEXT,
  override_reason TEXT,
  affected_count INT,
  risk_level VARCHAR(20),
  reviewer_id UUID NOT NULL REFERENCES "user"(id),
  reviewed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_hol_org_idx ON ai_human_oversight_log(org_id);
CREATE INDEX ai_hol_system_idx ON ai_human_oversight_log(ai_system_id);
CREATE INDEX ai_hol_type_idx ON ai_human_oversight_log(org_id, log_type);
CREATE INDEX ai_hol_date_idx ON ai_human_oversight_log(org_id, reviewed_at);

ALTER TABLE ai_human_oversight_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_human_oversight_log_org_isolation ON ai_human_oversight_log
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER ai_human_oversight_log_audit
  AFTER INSERT OR UPDATE OR DELETE ON ai_human_oversight_log
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
