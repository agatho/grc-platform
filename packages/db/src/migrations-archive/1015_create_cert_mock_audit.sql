-- Sprint 76: Certification und Audit Prep Wizard
-- Migration 1015: Create cert_mock_audit table

CREATE TABLE IF NOT EXISTS cert_mock_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  assessment_id UUID REFERENCES cert_readiness_assessment(id) ON DELETE CASCADE,
  audit_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  framework VARCHAR(50) NOT NULL,
  audit_type VARCHAR(50) NOT NULL,
  scope TEXT,
  questions JSONB DEFAULT '[]',
  total_questions INT NOT NULL DEFAULT 0,
  answered_questions INT NOT NULL DEFAULT 0,
  responses JSONB DEFAULT '[]',
  overall_score NUMERIC(5,2),
  findings JSONB DEFAULT '[]',
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  auditor_id UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cma_code_idx ON cert_mock_audit(org_id, audit_code);
CREATE INDEX cma_org_idx ON cert_mock_audit(org_id);
CREATE INDEX cma_assess_idx ON cert_mock_audit(assessment_id);
CREATE INDEX cma_fw_idx ON cert_mock_audit(org_id, framework);
CREATE INDEX cma_status_idx ON cert_mock_audit(org_id, status);

ALTER TABLE cert_mock_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY cert_mock_audit_org_isolation ON cert_mock_audit
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER cert_mock_audit_audit
  AFTER INSERT OR UPDATE OR DELETE ON cert_mock_audit
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
