-- Sprint 73: EU AI Act Governance Module
-- Migration 997: Create ai_conformity_assessment table

CREATE TABLE IF NOT EXISTS ai_conformity_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id) ON DELETE CASCADE,
  assessment_code VARCHAR(30) NOT NULL,
  assessment_type VARCHAR(50) NOT NULL,
  assessor_name VARCHAR(500),
  requirements JSONB DEFAULT '[]',
  overall_result VARCHAR(20),
  findings JSONB DEFAULT '[]',
  certificate_ref VARCHAR(200),
  valid_from DATE,
  valid_until DATE,
  assessed_at TIMESTAMPTZ,
  assessed_by UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_ca_code_idx ON ai_conformity_assessment(org_id, assessment_code);
CREATE INDEX ai_ca_org_idx ON ai_conformity_assessment(org_id);
CREATE INDEX ai_ca_system_idx ON ai_conformity_assessment(ai_system_id);
CREATE INDEX ai_ca_result_idx ON ai_conformity_assessment(org_id, overall_result);
CREATE INDEX ai_ca_status_idx ON ai_conformity_assessment(org_id, status);

ALTER TABLE ai_conformity_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_conformity_assessment_org_isolation ON ai_conformity_assessment
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER ai_conformity_assessment_audit
  AFTER INSERT OR UPDATE OR DELETE ON ai_conformity_assessment
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
