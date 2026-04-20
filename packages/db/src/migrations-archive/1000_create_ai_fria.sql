-- Sprint 73: EU AI Act Governance Module
-- Migration 1000: Create ai_fria table

CREATE TABLE IF NOT EXISTS ai_fria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id) ON DELETE CASCADE,
  assessment_code VARCHAR(30) NOT NULL,
  rights_assessed JSONB DEFAULT '[]',
  discrimination_risk JSONB DEFAULT '{}',
  data_protection_impact JSONB DEFAULT '{}',
  access_to_justice JSONB DEFAULT '{}',
  overall_impact VARCHAR(20) NOT NULL,
  mitigation_plan TEXT,
  consultation_results JSONB DEFAULT '[]',
  assessed_by UUID REFERENCES "user"(id),
  assessed_at TIMESTAMPTZ,
  next_review_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_fria_code_idx ON ai_fria(org_id, assessment_code);
CREATE INDEX ai_fria_org_idx ON ai_fria(org_id);
CREATE INDEX ai_fria_system_idx ON ai_fria(ai_system_id);
CREATE INDEX ai_fria_impact_idx ON ai_fria(org_id, overall_impact);
CREATE INDEX ai_fria_status_idx ON ai_fria(org_id, status);

ALTER TABLE ai_fria ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_fria_org_isolation ON ai_fria
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER ai_fria_audit
  AFTER INSERT OR UPDATE OR DELETE ON ai_fria
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
