-- Sprint 85: Simulation und Scenario Engine
-- Migration 1062: Create simulation_comparison table

CREATE TABLE IF NOT EXISTS simulation_comparison (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  description TEXT,
  scenario_ids JSONB NOT NULL DEFAULT '[]',
  comparison_metrics JSONB NOT NULL DEFAULT '[]',
  result_summary_json JSONB NOT NULL DEFAULT '{}',
  export_url VARCHAR(2000),
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sc_org_idx ON simulation_comparison(org_id);

ALTER TABLE simulation_comparison ENABLE ROW LEVEL SECURITY;
CREATE POLICY simulation_comparison_org_isolation ON simulation_comparison
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER simulation_comparison_audit
  AFTER INSERT OR UPDATE OR DELETE ON simulation_comparison
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
