-- Sprint 69: AI Regulatory Change Agent
-- Migration 976: Create regulatory_impact_assessment table

CREATE TABLE IF NOT EXISTS regulatory_impact_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id UUID NOT NULL REFERENCES regulatory_change(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  impact_level VARCHAR(20) NOT NULL,
  impact_areas JSONB DEFAULT '[]',
  affected_controls JSONB DEFAULT '[]',
  affected_processes JSONB DEFAULT '[]',
  required_actions JSONB DEFAULT '[]',
  estimated_effort VARCHAR(50),
  compliance_deadline DATE,
  ai_reasoning TEXT,
  confidence_score NUMERIC(5,2),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES "user"(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ria_change_idx ON regulatory_impact_assessment(change_id);
CREATE INDEX ria_org_idx ON regulatory_impact_assessment(org_id);
CREATE INDEX ria_impact_idx ON regulatory_impact_assessment(org_id, impact_level);
CREATE INDEX ria_status_idx ON regulatory_impact_assessment(org_id, status);

ALTER TABLE regulatory_impact_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY regulatory_impact_assessment_org_isolation ON regulatory_impact_assessment
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER regulatory_impact_assessment_audit
  AFTER INSERT OR UPDATE OR DELETE ON regulatory_impact_assessment
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
