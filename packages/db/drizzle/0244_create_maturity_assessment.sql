-- Sprint 78: GRC Benchmarking und Maturity Model
-- Migration 1025: Create maturity_assessment table

DO $$ BEGIN
  CREATE TYPE maturity_assessment_status AS ENUM ('draft', 'in_progress', 'completed', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS maturity_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  module_key maturity_module_key NOT NULL,
  status maturity_assessment_status NOT NULL DEFAULT 'draft',
  assessor_id UUID REFERENCES "user"(id),
  overall_score NUMERIC(5,2),
  level maturity_level,
  criteria_scores JSONB NOT NULL DEFAULT '[]',
  evidence_refs JSONB NOT NULL DEFAULT '[]',
  findings JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  approved_by UUID REFERENCES "user"(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX maturity_assessment_org_idx ON maturity_assessment(org_id);
CREATE INDEX maturity_assessment_module_idx ON maturity_assessment(org_id, module_key);
CREATE INDEX maturity_assessment_status_idx ON maturity_assessment(org_id, status);

ALTER TABLE maturity_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY maturity_assessment_org_isolation ON maturity_assessment
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER maturity_assessment_audit
  AFTER INSERT OR UPDATE OR DELETE ON maturity_assessment
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
