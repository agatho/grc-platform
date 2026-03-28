-- Sprint 76: Certification und Audit Prep Wizard
-- Migration 1013: Create cert_readiness_assessment table

CREATE TABLE IF NOT EXISTS cert_readiness_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  assessment_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  framework VARCHAR(50) NOT NULL,
  framework_version VARCHAR(50),
  scope TEXT,
  target_cert_date DATE,
  total_controls INT NOT NULL DEFAULT 0,
  implemented_controls INT NOT NULL DEFAULT 0,
  partial_controls INT NOT NULL DEFAULT 0,
  not_implemented INT NOT NULL DEFAULT 0,
  not_applicable INT NOT NULL DEFAULT 0,
  readiness_score NUMERIC(5,2),
  control_details JSONB DEFAULT '[]',
  gap_analysis JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  risks JSONB DEFAULT '[]',
  lead_assessor_id UUID REFERENCES "user"(id),
  assessed_at TIMESTAMPTZ,
  next_review_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cra_code_idx ON cert_readiness_assessment(org_id, assessment_code);
CREATE INDEX cra_org_idx ON cert_readiness_assessment(org_id);
CREATE INDEX cra_fw_idx ON cert_readiness_assessment(org_id, framework);
CREATE INDEX cra_status_idx ON cert_readiness_assessment(org_id, status);
CREATE INDEX cra_score_idx ON cert_readiness_assessment(org_id, readiness_score);

ALTER TABLE cert_readiness_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY cert_readiness_assessment_org_isolation ON cert_readiness_assessment
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER cert_readiness_assessment_audit
  AFTER INSERT OR UPDATE OR DELETE ON cert_readiness_assessment
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
