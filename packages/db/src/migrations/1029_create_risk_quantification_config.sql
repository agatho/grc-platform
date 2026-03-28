-- Sprint 79: Unified Risk Quantification Dashboard
-- Migration 1029: Create risk_quantification_config table

DO $$ BEGIN
  CREATE TYPE rq_methodology AS ENUM ('fair', 'monte_carlo', 'qualitative', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS risk_quantification_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  methodology rq_methodology NOT NULL DEFAULT 'hybrid',
  default_iterations INT NOT NULL DEFAULT 10000,
  confidence_level NUMERIC(5,2) NOT NULL DEFAULT 0.95,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'EUR',
  aggregation_method VARCHAR(50) NOT NULL DEFAULT 'sum',
  include_correlations BOOLEAN NOT NULL DEFAULT false,
  correlation_matrix JSONB,
  config_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rqc_org_unique ON risk_quantification_config(org_id);

ALTER TABLE risk_quantification_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_quantification_config_org_isolation ON risk_quantification_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER risk_quantification_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_quantification_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
