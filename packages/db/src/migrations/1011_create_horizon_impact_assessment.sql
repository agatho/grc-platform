-- Sprint 75: Regulatory Horizon Scanner
-- Migration 1011: Create horizon_impact_assessment table

CREATE TABLE IF NOT EXISTS horizon_impact_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  scan_item_id UUID NOT NULL REFERENCES horizon_scan_item(id) ON DELETE CASCADE,
  impact_level VARCHAR(20) NOT NULL,
  impact_areas JSONB DEFAULT '[]',
  affected_controls JSONB DEFAULT '[]',
  affected_processes JSONB DEFAULT '[]',
  required_actions JSONB DEFAULT '[]',
  estimated_effort VARCHAR(50),
  compliance_deadline DATE,
  ai_reasoning TEXT,
  confidence_score NUMERIC(5,2),
  assessed_by UUID REFERENCES "user"(id),
  approved_by UUID REFERENCES "user"(id),
  approved_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX hia_org_idx ON horizon_impact_assessment(org_id);
CREATE INDEX hia_item_idx ON horizon_impact_assessment(scan_item_id);
CREATE INDEX hia_impact_idx ON horizon_impact_assessment(org_id, impact_level);
CREATE INDEX hia_status_idx ON horizon_impact_assessment(org_id, status);

ALTER TABLE horizon_impact_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY horizon_impact_assessment_org_isolation ON horizon_impact_assessment
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER horizon_impact_assessment_audit
  AFTER INSERT OR UPDATE OR DELETE ON horizon_impact_assessment
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
