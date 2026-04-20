-- Sprint 85: Simulation und Scenario Engine
-- Migration 1059: Create simulation_run table

CREATE TABLE IF NOT EXISTS simulation_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  scenario_id UUID NOT NULL REFERENCES simulation_scenario(id) ON DELETE CASCADE,
  run_number INT NOT NULL DEFAULT 1,
  iterations INT NOT NULL DEFAULT 10000,
  confidence_level NUMERIC(5,2) NOT NULL DEFAULT 95.00,
  status simulation_status NOT NULL DEFAULT 'running',
  duration_ms INT,
  executed_by UUID REFERENCES "user"(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sr_org_idx ON simulation_run(org_id);
CREATE INDEX sr_scenario_idx ON simulation_run(scenario_id);
CREATE INDEX sr_status_idx ON simulation_run(status);

ALTER TABLE simulation_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY simulation_run_org_isolation ON simulation_run
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER simulation_run_audit
  AFTER INSERT OR UPDATE OR DELETE ON simulation_run
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
