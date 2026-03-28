-- Sprint 79: Unified Risk Quantification Dashboard
-- Migration 1032: Create risk_sensitivity_analysis table

CREATE TABLE IF NOT EXISTS risk_sensitivity_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  var_calculation_id UUID REFERENCES risk_var_calculation(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  baseline_var NUMERIC(15,2),
  scenarios_json JSONB NOT NULL DEFAULT '[]',
  tornado_data JSONB,
  waterfall_data JSONB,
  computed_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rsa_org_idx ON risk_sensitivity_analysis(org_id);
CREATE INDEX rsa_var_idx ON risk_sensitivity_analysis(var_calculation_id);

ALTER TABLE risk_sensitivity_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_sensitivity_analysis_org_isolation ON risk_sensitivity_analysis
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER risk_sensitivity_analysis_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_sensitivity_analysis
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
