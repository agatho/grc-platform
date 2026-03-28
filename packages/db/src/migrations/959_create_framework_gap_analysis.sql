-- Sprint 66: Cross-Framework Auto-Mapping Engine
-- Migration 959: Create framework_gap_analysis table

CREATE TABLE IF NOT EXISTS framework_gap_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  framework VARCHAR(50) NOT NULL,
  analysis_date TIMESTAMPTZ NOT NULL,
  total_controls INT NOT NULL,
  covered_controls INT NOT NULL,
  partially_covered_controls INT NOT NULL,
  not_covered_controls INT NOT NULL,
  not_applicable_controls INT NOT NULL DEFAULT 0,
  coverage_percentage NUMERIC(5,2) NOT NULL,
  gap_details JSONB DEFAULT '[]',
  prioritized_actions JSONB DEFAULT '[]',
  risk_exposure VARCHAR(20),
  estimated_effort_days INT,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fga_org_idx ON framework_gap_analysis(org_id);
CREATE INDEX fga_framework_idx ON framework_gap_analysis(framework);
CREATE INDEX fga_date_idx ON framework_gap_analysis(analysis_date);

-- RLS
ALTER TABLE framework_gap_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY framework_gap_analysis_org_isolation ON framework_gap_analysis
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER framework_gap_analysis_audit AFTER INSERT OR UPDATE OR DELETE ON framework_gap_analysis
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
