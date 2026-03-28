-- Sprint 85: Simulation und Scenario Engine
-- Migration 1058: Create simulation_scenario table

DO $$ BEGIN
  CREATE TYPE simulation_type AS ENUM ('what_if', 'bpm_cost_time', 'business_impact', 'monte_carlo', 'supplier_cascade', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE simulation_status AS ENUM ('draft', 'configuring', 'running', 'completed', 'failed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE simulation_scenario_tag AS ENUM ('as_is', 'to_be_a', 'to_be_b', 'to_be_c', 'best_case', 'worst_case', 'most_likely');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS simulation_scenario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  simulation_type simulation_type NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  tag simulation_scenario_tag NOT NULL DEFAULT 'as_is',
  status simulation_status NOT NULL DEFAULT 'draft',
  input_parameters_json JSONB NOT NULL DEFAULT '{}',
  assumptions_json JSONB NOT NULL DEFAULT '[]',
  source_entity_type VARCHAR(100),
  source_entity_id UUID,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ss_org_idx ON simulation_scenario(org_id);
CREATE INDEX ss_type_idx ON simulation_scenario(org_id, simulation_type);
CREATE INDEX ss_status_idx ON simulation_scenario(org_id, status);
CREATE INDEX ss_tag_idx ON simulation_scenario(org_id, tag);

ALTER TABLE simulation_scenario ENABLE ROW LEVEL SECURITY;
CREATE POLICY simulation_scenario_org_isolation ON simulation_scenario
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER simulation_scenario_audit
  AFTER INSERT OR UPDATE OR DELETE ON simulation_scenario
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
