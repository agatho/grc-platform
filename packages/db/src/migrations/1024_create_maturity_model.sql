-- Sprint 78: GRC Benchmarking und Maturity Model
-- Migration 1024: Create maturity_model table

DO $$ BEGIN
  CREATE TYPE maturity_level AS ENUM ('initial', 'managed', 'defined', 'quantitatively_managed', 'optimizing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE maturity_module_key AS ENUM ('erm', 'isms', 'bcms', 'dpms', 'audit', 'ics', 'esg', 'tprm', 'bpm', 'overall');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS maturity_model (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  module_key maturity_module_key NOT NULL,
  current_level maturity_level NOT NULL DEFAULT 'initial',
  target_level maturity_level,
  target_date TIMESTAMPTZ,
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  auto_calculated BOOLEAN NOT NULL DEFAULT true,
  last_calculated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mm_org_idx ON maturity_model(org_id);
CREATE UNIQUE INDEX mm_org_module_unique ON maturity_model(org_id, module_key);

ALTER TABLE maturity_model ENABLE ROW LEVEL SECURITY;
CREATE POLICY maturity_model_org_isolation ON maturity_model
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER maturity_model_audit
  AFTER INSERT OR UPDATE OR DELETE ON maturity_model
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
