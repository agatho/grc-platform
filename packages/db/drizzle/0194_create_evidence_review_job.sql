-- Sprint 68: AI Evidence Review Agent
-- Migration 969: Create evidence_review_job table

CREATE TABLE IF NOT EXISTS evidence_review_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  description TEXT,
  scope VARCHAR(50) NOT NULL DEFAULT 'all',
  scope_filter JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_artifacts INT NOT NULL DEFAULT 0,
  reviewed_artifacts INT NOT NULL DEFAULT 0,
  compliant_artifacts INT NOT NULL DEFAULT 0,
  non_compliant_artifacts INT NOT NULL DEFAULT 0,
  gaps_identified INT NOT NULL DEFAULT 0,
  overall_confidence NUMERIC(5,2),
  model VARCHAR(100),
  total_tokens_used INT NOT NULL DEFAULT 0,
  duration_ms INT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX erj_org_idx ON evidence_review_job(org_id);
CREATE INDEX erj_status_idx ON evidence_review_job(org_id, status);
CREATE INDEX erj_created_idx ON evidence_review_job(org_id, created_at);

ALTER TABLE evidence_review_job ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_review_job_org_isolation ON evidence_review_job
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER evidence_review_job_audit
  AFTER INSERT OR UPDATE OR DELETE ON evidence_review_job
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
