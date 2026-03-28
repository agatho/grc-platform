-- Sprint 79: Unified Risk Quantification Dashboard
-- Migration 1031: Create risk_appetite_threshold table

DO $$ BEGIN
  CREATE TYPE rq_appetite_status AS ENUM ('within_appetite', 'approaching_limit', 'exceeds_appetite', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS risk_appetite_threshold (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(300) NOT NULL,
  category VARCHAR(100),
  appetite_amount NUMERIC(15,2) NOT NULL,
  tolerance_amount NUMERIC(15,2),
  current_exposure NUMERIC(15,2),
  status rq_appetite_status NOT NULL DEFAULT 'within_appetite',
  last_updated_at TIMESTAMPTZ,
  alert_enabled BOOLEAN NOT NULL DEFAULT true,
  trend_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rat_org_idx ON risk_appetite_threshold(org_id);
CREATE INDEX rat_status_idx ON risk_appetite_threshold(org_id, status);

ALTER TABLE risk_appetite_threshold ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_appetite_threshold_org_isolation ON risk_appetite_threshold
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER risk_appetite_threshold_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_appetite_threshold
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
