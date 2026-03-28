-- Sprint 78: GRC Benchmarking und Maturity Model
-- Migration 1028: Create benchmark_submission table

CREATE TABLE IF NOT EXISTS benchmark_submission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  module_key maturity_module_key NOT NULL,
  industry benchmark_industry NOT NULL,
  org_size_range VARCHAR(50) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  level maturity_level NOT NULL,
  anonymized_data JSONB NOT NULL DEFAULT '{}',
  consent_given BOOLEAN NOT NULL DEFAULT false,
  submitted_by UUID REFERENCES "user"(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bs_org_idx ON benchmark_submission(org_id);
CREATE INDEX bs_module_idx ON benchmark_submission(org_id, module_key);

ALTER TABLE benchmark_submission ENABLE ROW LEVEL SECURITY;
CREATE POLICY benchmark_submission_org_isolation ON benchmark_submission
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER benchmark_submission_audit
  AFTER INSERT OR UPDATE OR DELETE ON benchmark_submission
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
