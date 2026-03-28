-- Sprint 85: Simulation und Scenario Engine
-- Migration 1060: Create simulation_parameter table

CREATE TABLE IF NOT EXISTS simulation_parameter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  scenario_id UUID NOT NULL REFERENCES simulation_scenario(id) ON DELETE CASCADE,
  parameter_key VARCHAR(200) NOT NULL,
  display_name VARCHAR(300) NOT NULL,
  parameter_type VARCHAR(50) NOT NULL DEFAULT 'number',
  min_value NUMERIC(20,6),
  max_value NUMERIC(20,6),
  default_value NUMERIC(20,6),
  distribution VARCHAR(50) DEFAULT 'normal',
  unit VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sp_org_idx ON simulation_parameter(org_id);
CREATE INDEX sp_scenario_idx ON simulation_parameter(scenario_id);
CREATE UNIQUE INDEX sp_scenario_key ON simulation_parameter(scenario_id, parameter_key);

ALTER TABLE simulation_parameter ENABLE ROW LEVEL SECURITY;
CREATE POLICY simulation_parameter_org_isolation ON simulation_parameter
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER simulation_parameter_audit
  AFTER INSERT OR UPDATE OR DELETE ON simulation_parameter
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
