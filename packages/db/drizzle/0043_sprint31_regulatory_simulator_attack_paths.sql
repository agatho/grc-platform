-- Sprint 31: Regulatory Simulator + Attack Path Visualization
-- Migrations 395–398 consolidated

-- ──────────────────────────────────────────────────────────────
-- 395: regulation_simulation
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regulation_simulation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  regulation_name VARCHAR(200) NOT NULL,
  scenario_type VARCHAR(30) NOT NULL,
  parameters_json JSONB NOT NULL,
  before_score DECIMAL(5,2) NOT NULL,
  after_score DECIMAL(5,2) NOT NULL,
  gap_count INTEGER NOT NULL,
  gaps_json JSONB NOT NULL,
  estimated_total_cost DECIMAL(12,2),
  timeline_json JSONB,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rs_org_idx ON regulation_simulation(org_id);
CREATE INDEX IF NOT EXISTS rs_scenario_idx ON regulation_simulation(org_id, scenario_type);

-- ──────────────────────────────────────────────────────────────
-- 396: attack_path_result
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attack_path_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  entry_asset_id UUID NOT NULL REFERENCES asset(id),
  target_asset_id UUID NOT NULL REFERENCES asset(id),
  path_json JSONB NOT NULL,
  hop_count INTEGER NOT NULL,
  risk_score DECIMAL(5,2) NOT NULL,
  blocking_controls_json JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS apr_org_idx ON attack_path_result(org_id);
CREATE INDEX IF NOT EXISTS apr_batch_idx ON attack_path_result(org_id, batch_id);
CREATE INDEX IF NOT EXISTS apr_entry_idx ON attack_path_result(org_id, entry_asset_id);
CREATE INDEX IF NOT EXISTS apr_target_idx ON attack_path_result(org_id, target_asset_id);

-- ──────────────────────────────────────────────────────────────
-- 397: RLS policies + audit triggers
-- ──────────────────────────────────────────────────────────────

ALTER TABLE regulation_simulation ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_path_result ENABLE ROW LEVEL SECURITY;

CREATE POLICY regulation_simulation_org_isolation ON regulation_simulation
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY attack_path_result_org_isolation ON attack_path_result
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit triggers
CREATE TRIGGER regulation_simulation_audit
  AFTER INSERT OR UPDATE OR DELETE ON regulation_simulation
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER attack_path_result_audit
  AFTER INSERT OR UPDATE OR DELETE ON attack_path_result
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 398: Add is_crown_jewel + exposure to asset table
-- ──────────────────────────────────────────────────────────────

ALTER TABLE asset ADD COLUMN IF NOT EXISTS is_crown_jewel BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS exposure VARCHAR(30);
