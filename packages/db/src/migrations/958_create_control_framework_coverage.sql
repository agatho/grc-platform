-- Sprint 66: Cross-Framework Auto-Mapping Engine
-- Migration 958: Create control_framework_coverage table

CREATE TABLE IF NOT EXISTS control_framework_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  control_id UUID NOT NULL,
  framework VARCHAR(50) NOT NULL,
  framework_control_id VARCHAR(100) NOT NULL,
  coverage_status VARCHAR(30) NOT NULL,
  coverage_source VARCHAR(30) NOT NULL,
  evidence_status VARCHAR(30) NOT NULL DEFAULT 'missing',
  last_assessed_at TIMESTAMPTZ,
  assessment_result VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cfc_org_idx ON control_framework_coverage(org_id);
CREATE INDEX cfc_control_idx ON control_framework_coverage(control_id);
CREATE INDEX cfc_framework_idx ON control_framework_coverage(framework);
CREATE INDEX cfc_status_idx ON control_framework_coverage(coverage_status);
CREATE UNIQUE INDEX cfc_unique_idx ON control_framework_coverage(org_id, control_id, framework, framework_control_id);

-- RLS
ALTER TABLE control_framework_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_framework_coverage_org_isolation ON control_framework_coverage
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER control_framework_coverage_audit AFTER INSERT OR UPDATE OR DELETE ON control_framework_coverage
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
