-- Sprint 76: Certification und Audit Prep Wizard
-- Migration 1014: Create cert_evidence_package table

CREATE TABLE IF NOT EXISTS cert_evidence_package (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  assessment_id UUID REFERENCES cert_readiness_assessment(id) ON DELETE CASCADE,
  package_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  framework VARCHAR(50) NOT NULL,
  control_refs TEXT[],
  evidence_items JSONB DEFAULT '[]',
  completeness NUMERIC(5,2),
  missing_evidence JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ,
  generated_by UUID REFERENCES "user"(id),
  export_format VARCHAR(20),
  export_url VARCHAR(2000),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cep_code_idx ON cert_evidence_package(org_id, package_code);
CREATE INDEX cep_org_idx ON cert_evidence_package(org_id);
CREATE INDEX cep_assess_idx ON cert_evidence_package(assessment_id);
CREATE INDEX cep_fw_idx ON cert_evidence_package(org_id, framework);
CREATE INDEX cep_status_idx ON cert_evidence_package(org_id, status);

ALTER TABLE cert_evidence_package ENABLE ROW LEVEL SECURITY;
CREATE POLICY cert_evidence_package_org_isolation ON cert_evidence_package
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER cert_evidence_package_audit
  AFTER INSERT OR UPDATE OR DELETE ON cert_evidence_package
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
