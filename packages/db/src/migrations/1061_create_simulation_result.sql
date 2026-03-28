-- Sprint 85: Simulation und Scenario Engine
-- Migration 1061: Create simulation_result table

CREATE TABLE IF NOT EXISTS simulation_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  run_id UUID NOT NULL REFERENCES simulation_run(id) ON DELETE CASCADE,
  metric_key VARCHAR(200) NOT NULL,
  metric_name VARCHAR(300) NOT NULL,
  mean_value NUMERIC(20,6),
  median_value NUMERIC(20,6),
  p5_value NUMERIC(20,6),
  p95_value NUMERIC(20,6),
  min_value NUMERIC(20,6),
  max_value NUMERIC(20,6),
  std_dev NUMERIC(20,6),
  histogram_json JSONB NOT NULL DEFAULT '[]',
  unit VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sres_org_idx ON simulation_result(org_id);
CREATE INDEX sres_run_idx ON simulation_result(run_id);

ALTER TABLE simulation_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY simulation_result_org_isolation ON simulation_result
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER simulation_result_audit
  AFTER INSERT OR UPDATE OR DELETE ON simulation_result
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
