-- Sprint 68: AI Evidence Review Agent
-- Migration 970: Create evidence_review_result table

CREATE TABLE IF NOT EXISTS evidence_review_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES evidence_review_job(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  evidence_id UUID NOT NULL,
  control_id UUID,
  artifact_name VARCHAR(500) NOT NULL,
  classification VARCHAR(30) NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL,
  reasoning TEXT NOT NULL,
  requirements JSONB DEFAULT '[]',
  completeness_score NUMERIC(5,2),
  freshness_score NUMERIC(5,2),
  quality_score NUMERIC(5,2),
  suggested_improvements JSONB DEFAULT '[]',
  ai_decision_log JSONB DEFAULT '{}',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX err_job_idx ON evidence_review_result(job_id);
CREATE INDEX err_org_idx ON evidence_review_result(org_id);
CREATE INDEX err_evidence_idx ON evidence_review_result(org_id, evidence_id);
CREATE INDEX err_class_idx ON evidence_review_result(org_id, classification);
CREATE INDEX err_control_idx ON evidence_review_result(org_id, control_id);

ALTER TABLE evidence_review_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_review_result_org_isolation ON evidence_review_result
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER evidence_review_result_audit
  AFTER INSERT OR UPDATE OR DELETE ON evidence_review_result
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
