-- Sprint 79: Unified Risk Quantification Dashboard
-- Migration 1033: Create risk_executive_summary table

DO $$ BEGIN
  CREATE TYPE rq_summary_status AS ENUM ('draft', 'final', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS risk_executive_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  title VARCHAR(500) NOT NULL,
  period_label VARCHAR(100),
  status rq_summary_status NOT NULL DEFAULT 'draft',
  executive_summary TEXT,
  top_risks JSONB NOT NULL DEFAULT '[]',
  key_metrics JSONB NOT NULL DEFAULT '{}',
  trend_comparison JSONB,
  recommendations JSONB NOT NULL DEFAULT '[]',
  export_format VARCHAR(10),
  export_path VARCHAR(1000),
  approved_by UUID REFERENCES "user"(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX res_org_idx ON risk_executive_summary(org_id);
CREATE INDEX res_status_idx ON risk_executive_summary(org_id, status);
CREATE INDEX res_period_idx ON risk_executive_summary(org_id, period_label);

ALTER TABLE risk_executive_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_executive_summary_org_isolation ON risk_executive_summary
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER risk_executive_summary_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_executive_summary
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
