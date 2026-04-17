-- ADR-014 Phase 2: Die 8 Tabellen nachziehen, die im Drizzle-Schema existieren,
-- aber nie eine Migration bekommen hatten. Identifiziert durch den
-- /api/v1/health/schema-drift Endpoint (F-18) nach dem F-17 Catch-up.
--
-- Betroffene Features:
--   Sprint 30: reportTemplate, reportGenerationLog, reportSchedule  (Report Engine)
--   Sprint 33: auditRiskPrediction, auditRiskPredictionModel        (Predictive Audit Risk)
--   Sprint 85: scenarioEngineScenario, simulationRunResult          (Simulation Engine)
--   ABAC-bound: processSimulationResult                             (Process-Simulation)
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE TYPE via DO-Block.
-- Kann auf bereits teilweise migrierten Tenants gefahrlos erneut laufen.

-- ──────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE report_module_scope AS ENUM ('erm','ics','isms','audit','dpms','esg','bcms','tprm','all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_generation_status AS ENUM ('queued','generating','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_output_format AS ENUM ('pdf','xlsx');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE simulation_type AS ENUM ('what_if','bpm_cost_time','business_impact','monte_carlo','supplier_cascade','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE simulation_status AS ENUM ('draft','configuring','running','completed','failed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE simulation_scenario_tag AS ENUM ('as_is','to_be_a','to_be_b','to_be_c','best_case','worst_case','most_likely');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- report_template  (Sprint 30)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_template (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organization(id),
  name             VARCHAR(500) NOT NULL,
  description      TEXT,
  module_scope     report_module_scope NOT NULL DEFAULT 'all',
  sections_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  parameters_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  branding_json    JSONB,
  is_default       BOOLEAN NOT NULL DEFAULT false,
  created_by       UUID REFERENCES "user"(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rt_org_idx ON report_template(org_id);
CREATE INDEX IF NOT EXISTS rt_scope_idx ON report_template(org_id, module_scope);

-- ──────────────────────────────────────────────────────────────
-- report_generation_log  (Sprint 30)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_generation_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organization(id),
  template_id         UUID NOT NULL REFERENCES report_template(id),
  status              report_generation_status NOT NULL DEFAULT 'queued',
  parameters_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_format       report_output_format NOT NULL DEFAULT 'pdf',
  file_path           VARCHAR(1000),
  file_size           INT,
  generation_time_ms  INT,
  error               TEXT,
  generated_by        UUID REFERENCES "user"(id),
  schedule_id         UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS rgl_org_idx ON report_generation_log(org_id);
CREATE INDEX IF NOT EXISTS rgl_status_idx ON report_generation_log(org_id, status);
CREATE INDEX IF NOT EXISTS rgl_template_idx ON report_generation_log(template_id);

-- ──────────────────────────────────────────────────────────────
-- report_schedule  (Sprint 30)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organization(id),
  template_id       UUID NOT NULL REFERENCES report_template(id),
  name              VARCHAR(500),
  cron_expression   VARCHAR(100) NOT NULL,
  parameters_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_emails  JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_format     report_output_format NOT NULL DEFAULT 'pdf',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_run_at       TIMESTAMPTZ,
  next_run_at       TIMESTAMPTZ,
  created_by        UUID REFERENCES "user"(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rsched_org_idx ON report_schedule(org_id);
CREATE INDEX IF NOT EXISTS rs_next_run_idx ON report_schedule(is_active, next_run_at);

-- ──────────────────────────────────────────────────────────────
-- audit_risk_prediction  (Sprint 33)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_risk_prediction (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organization(id),
  risk_id                   UUID NOT NULL,
  prediction_horizon_days   INT NOT NULL DEFAULT 90,
  escalation_probability    NUMERIC(5,2) NOT NULL,
  predicted_score           NUMERIC(5,2),
  features_json             JSONB NOT NULL,
  top_factors_json          JSONB NOT NULL,
  model_version             VARCHAR(50) NOT NULL,
  confidence                NUMERIC(5,2),
  computed_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arp_org_risk_idx ON audit_risk_prediction(org_id, risk_id);
CREATE INDEX IF NOT EXISTS arp_prob_idx ON audit_risk_prediction(org_id, escalation_probability);

-- ──────────────────────────────────────────────────────────────
-- audit_risk_prediction_model  (Sprint 33)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_risk_prediction_model (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organization(id),
  version                   VARCHAR(50) NOT NULL,
  algorithm                 VARCHAR(30) NOT NULL DEFAULT 'linear_regression',
  feature_importance_json   JSONB NOT NULL,
  training_metrics          JSONB NOT NULL,
  trained_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arpm_org_idx ON audit_risk_prediction_model(org_id);

-- ──────────────────────────────────────────────────────────────
-- scenario_engine_scenario  (Sprint 85)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scenario_engine_scenario (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organization(id),
  simulation_type         simulation_type NOT NULL,
  name                    VARCHAR(500) NOT NULL,
  description             TEXT,
  tag                     simulation_scenario_tag NOT NULL DEFAULT 'as_is',
  status                  simulation_status NOT NULL DEFAULT 'draft',
  input_parameters_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  assumptions_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_entity_type      VARCHAR(100),
  source_entity_id        UUID,
  created_by              UUID REFERENCES "user"(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ses_org_idx ON scenario_engine_scenario(org_id);
CREATE INDEX IF NOT EXISTS ses_type_idx ON scenario_engine_scenario(org_id, simulation_type);
CREATE INDEX IF NOT EXISTS ses_status_idx ON scenario_engine_scenario(org_id, status);
CREATE INDEX IF NOT EXISTS ses_tag_idx ON scenario_engine_scenario(org_id, tag);

-- ──────────────────────────────────────────────────────────────
-- simulation_run_result  (Sprint 85)  — FK to existing simulation_run
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS simulation_run_result (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organization(id),
  run_id          UUID NOT NULL REFERENCES simulation_run(id) ON DELETE CASCADE,
  metric_key      VARCHAR(200) NOT NULL,
  metric_name     VARCHAR(300) NOT NULL,
  mean_value      NUMERIC(20,6),
  median_value    NUMERIC(20,6),
  p5_value        NUMERIC(20,6),
  p95_value       NUMERIC(20,6),
  min_value       NUMERIC(20,6),
  max_value       NUMERIC(20,6),
  std_dev         NUMERIC(20,6),
  histogram_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  unit            VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sres_org_idx ON simulation_run_result(org_id);
CREATE INDEX IF NOT EXISTS sres_run_idx ON simulation_run_result(run_id);

-- ──────────────────────────────────────────────────────────────
-- process_simulation_result  (ABAC / BPM) — FK to existing simulation_scenario
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS process_simulation_result (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id             UUID NOT NULL REFERENCES simulation_scenario(id) ON DELETE CASCADE,
  org_id                  UUID NOT NULL,
  case_count              INT NOT NULL,
  avg_cycle_time          NUMERIC(15,4),
  p50_cycle_time          NUMERIC(15,4),
  p95_cycle_time          NUMERIC(15,4),
  avg_cost                NUMERIC(15,2),
  total_cost              NUMERIC(15,2),
  bottleneck_activities   JSONB DEFAULT '[]'::jsonb,
  cost_breakdown          JSONB DEFAULT '{}'::jsonb,
  resource_utilization    JSONB DEFAULT '{}'::jsonb,
  histogram               JSONB DEFAULT '[]'::jsonb,
  raw_results             JSONB,
  executed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psim_result_scenario_idx ON process_simulation_result(scenario_id);
