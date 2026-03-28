-- Sprint 25: FAIR Monte Carlo Cyber Risk Quantification
-- Migration 345–352 (combined)
-- Enhancement on ERM (Sprint 2): Financial risk quantification in EUR

-- ──────────────────────────────────────────────────────────────
-- 345: Create enums for FAIR
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "risk_methodology" AS ENUM ('qualitative', 'fair', 'hybrid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "fair_simulation_status" AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 345: Create fair_parameters
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "fair_parameters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "risk_id" uuid NOT NULL REFERENCES "risk"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  -- Loss Event Frequency (per year) — PERT distribution inputs
  "lef_min" numeric(10, 4) NOT NULL CHECK ("lef_min" >= 0),
  "lef_most_likely" numeric(10, 4) NOT NULL CHECK ("lef_most_likely" >= 0),
  "lef_max" numeric(10, 4) NOT NULL CHECK ("lef_max" >= 0),
  -- Loss Magnitude (EUR) — PERT distribution inputs
  "lm_min" numeric(15, 2) NOT NULL CHECK ("lm_min" >= 0),
  "lm_most_likely" numeric(15, 2) NOT NULL CHECK ("lm_most_likely" >= 0),
  "lm_max" numeric(15, 2) NOT NULL CHECK ("lm_max" >= 0),
  -- Loss component breakdown (JSONB, percentages summing to 100)
  "loss_components" jsonb DEFAULT '{}',
  -- Cross-cutting fields
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "user"("id"),
  "updated_by" uuid REFERENCES "user"("id"),
  -- Constraints
  CONSTRAINT "fair_params_lef_order" CHECK ("lef_min" <= "lef_most_likely" AND "lef_most_likely" <= "lef_max"),
  CONSTRAINT "fair_params_lm_order" CHECK ("lm_min" <= "lm_most_likely" AND "lm_most_likely" <= "lm_max"),
  CONSTRAINT "fair_params_risk_unique" UNIQUE ("risk_id")
);

CREATE INDEX IF NOT EXISTS "fair_params_org_idx" ON "fair_parameters" ("org_id");
CREATE INDEX IF NOT EXISTS "fair_params_risk_idx" ON "fair_parameters" ("risk_id");

-- ──────────────────────────────────────────────────────────────
-- 346: Create fair_simulation_result
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "fair_simulation_result" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "risk_id" uuid NOT NULL REFERENCES "risk"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "parameters_id" uuid REFERENCES "fair_parameters"("id"),
  -- Simulation config
  "iterations" integer NOT NULL DEFAULT 10000 CHECK ("iterations" >= 100 AND "iterations" <= 1000000),
  "status" "fair_simulation_status" NOT NULL DEFAULT 'pending',
  -- ALE percentiles (EUR)
  "ale_p5" numeric(15, 2),
  "ale_p25" numeric(15, 2),
  "ale_p50" numeric(15, 2),
  "ale_p75" numeric(15, 2),
  "ale_p95" numeric(15, 2),
  "ale_mean" numeric(15, 2),
  "ale_std_dev" numeric(15, 2),
  -- Chart data (JSONB)
  "histogram" jsonb,
  "loss_exceedance" jsonb,
  "sensitivity" jsonb,
  -- Error info
  "error_message" text,
  -- Timestamps
  "computed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "user"("id")
);

CREATE INDEX IF NOT EXISTS "fsr_risk_idx" ON "fair_simulation_result" ("risk_id");
CREATE INDEX IF NOT EXISTS "fsr_org_idx" ON "fair_simulation_result" ("org_id");
CREATE INDEX IF NOT EXISTS "fsr_computed_idx" ON "fair_simulation_result" ("risk_id", "computed_at");
CREATE INDEX IF NOT EXISTS "fsr_org_ale_idx" ON "fair_simulation_result" ("org_id", "ale_p50");

-- ──────────────────────────────────────────────────────────────
-- 347: RLS policies for Sprint 25 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "fair_parameters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fair_simulation_result" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fair_parameters_org_isolation" ON "fair_parameters"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY "fair_simulation_result_org_isolation" ON "fair_simulation_result"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- 348: Audit triggers for Sprint 25 tables
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER "fair_parameters_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "fair_parameters"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER "fair_simulation_result_audit"
  AFTER INSERT OR UPDATE ON "fair_simulation_result"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 349: ALTER organization.settings — risk_methodology
-- (Already a JSONB column, no DDL change needed. Default is 'qualitative'.)
-- This is a logical migration: the settings field now supports riskMethodology key.
-- ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN "organization"."settings" IS
  'JSONB settings including riskMethodology: qualitative|fair|hybrid (Sprint 25)';

-- ──────────────────────────────────────────────────────────────
-- 350: risk_appetite_threshold already has max_residual_ale (Sprint 23)
-- This migration confirms the column exists and adds a comment.
-- ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN "risk_appetite_threshold"."max_residual_ale" IS
  'Maximum residual ALE in EUR before escalation (Sprint 25 FAIR integration)';

-- ──────────────────────────────────────────────────────────────
-- 351: Additional performance indexes
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "fsr_org_status_completed_idx"
  ON "fair_simulation_result" ("org_id", "status")
  WHERE "status" = 'completed';

CREATE INDEX IF NOT EXISTS "fsr_risk_status_completed_idx"
  ON "fair_simulation_result" ("risk_id", "status", "computed_at" DESC)
  WHERE "status" = 'completed';

-- ──────────────────────────────────────────────────────────────
-- 352: Seed default loss component weights
-- ──────────────────────────────────────────────────────────────

-- Default loss components are provided in application code (DEFAULT_LOSS_COMPONENTS)
-- No database seed needed — components are set via API when creating FAIR parameters.
-- The following comment documents the standard FAIR taxonomy components:
-- productivity: 30%, response: 20%, replacement: 10%, fines: 15%, judgments: 10%, reputation: 15%

-- Grant permissions to grc role
GRANT SELECT, INSERT, UPDATE, DELETE ON "fair_parameters" TO grc;
GRANT SELECT, INSERT, UPDATE, DELETE ON "fair_simulation_result" TO grc;
