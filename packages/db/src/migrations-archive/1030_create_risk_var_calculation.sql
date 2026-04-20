-- Sprint 79: Unified Risk Quantification Dashboard
-- Migration 1030: Create risk_var_calculation table

DO $$ BEGIN
  CREATE TYPE rq_calculation_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS risk_var_calculation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  entity_label VARCHAR(300),
  methodology rq_methodology NOT NULL,
  status rq_calculation_status NOT NULL DEFAULT 'pending',
  iterations INT NOT NULL DEFAULT 10000,
  risk_count INT NOT NULL DEFAULT 0,
  var_p50 NUMERIC(15,2),
  var_p75 NUMERIC(15,2),
  var_p90 NUMERIC(15,2),
  var_p95 NUMERIC(15,2),
  var_p99 NUMERIC(15,2),
  expected_loss NUMERIC(15,2),
  standard_deviation NUMERIC(15,2),
  histogram JSONB,
  loss_exceedance JSONB,
  risk_contributions JSONB,
  computed_at TIMESTAMPTZ,
  computed_by UUID REFERENCES "user"(id),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rvc_org_idx ON risk_var_calculation(org_id);
CREATE INDEX rvc_status_idx ON risk_var_calculation(org_id, status);
CREATE INDEX rvc_computed_idx ON risk_var_calculation(org_id, computed_at);

ALTER TABLE risk_var_calculation ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_var_calculation_org_isolation ON risk_var_calculation
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER risk_var_calculation_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_var_calculation
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
