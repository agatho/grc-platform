-- Sprint 68: AI Evidence Review Agent
-- Migration 971: Create evidence_review_gap table

CREATE TABLE IF NOT EXISTS evidence_review_gap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES evidence_review_job(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  control_id UUID,
  gap_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  affected_requirements JSONB DEFAULT '[]',
  suggested_remediation TEXT,
  finding_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  acknowledged_by UUID REFERENCES "user"(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX erg_job_idx ON evidence_review_gap(job_id);
CREATE INDEX erg_org_idx ON evidence_review_gap(org_id);
CREATE INDEX erg_severity_idx ON evidence_review_gap(org_id, severity);
CREATE INDEX erg_status_idx ON evidence_review_gap(org_id, status);

ALTER TABLE evidence_review_gap ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_review_gap_org_isolation ON evidence_review_gap
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER evidence_review_gap_audit
  AFTER INSERT OR UPDATE OR DELETE ON evidence_review_gap
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
