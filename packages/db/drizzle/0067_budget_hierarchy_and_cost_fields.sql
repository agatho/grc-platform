-- Migration: Hierarchical budgets + cost fields on actionable entities
-- Adds: budget_type enum, named hierarchical budgets, cost fields on control,
--        risk_treatment, dpia_measure, continuity_strategy
-- Adds: whistleblowing_officer role to user_role enum

-- ──────────────────────────────────────────────────────────────
-- 1. New enums
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "budget_type" AS ENUM (
    'management_system',
    'department',
    'project',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'closed' to budget_status if missing
ALTER TYPE "budget_status" ADD VALUE IF NOT EXISTS 'closed';

-- Add 'whistleblowing_officer' to user_role enum
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'whistleblowing_officer';

-- ──────────────────────────────────────────────────────────────
-- 2. Enhance grc_budget — hierarchical named budgets
-- ──────────────────────────────────────────────────────────────

-- Add new columns
ALTER TABLE "grc_budget"
  ADD COLUMN IF NOT EXISTS "name" varchar(500),
  ADD COLUMN IF NOT EXISTS "budget_type" budget_type DEFAULT 'management_system',
  ADD COLUMN IF NOT EXISTS "grc_area" grc_area,
  ADD COLUMN IF NOT EXISTS "owner_id" uuid REFERENCES "user"("id"),
  ADD COLUMN IF NOT EXISTS "parent_budget_id" uuid REFERENCES "grc_budget"("id"),
  ADD COLUMN IF NOT EXISTS "period_start" date,
  ADD COLUMN IF NOT EXISTS "period_end" date;

-- Backfill name from year for existing rows
UPDATE "grc_budget"
  SET "name" = 'GRC Budget ' || "year"
  WHERE "name" IS NULL;

-- Make name NOT NULL after backfill
ALTER TABLE "grc_budget"
  ALTER COLUMN "name" SET NOT NULL;

-- Drop old unique index (org_id, year) — budgets are no longer 1-per-year
DROP INDEX IF EXISTS "gb_org_year_idx";

-- New indexes
CREATE INDEX IF NOT EXISTS "gb_org_type_idx" ON "grc_budget" ("org_id", "budget_type");
CREATE INDEX IF NOT EXISTS "gb_parent_idx" ON "grc_budget" ("parent_budget_id");
CREATE INDEX IF NOT EXISTS "gb_owner_idx" ON "grc_budget" ("owner_id");
CREATE INDEX IF NOT EXISTS "gb_org_area_idx" ON "grc_budget" ("org_id", "grc_area");

-- ──────────────────────────────────────────────────────────────
-- 3. Add budget_id index on grc_cost_entry
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "gce_budget_idx" ON "grc_cost_entry" ("budget_id");

-- ──────────────────────────────────────────────────────────────
-- 4. Cost fields on control table
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "control"
  ADD COLUMN IF NOT EXISTS "cost_onetime" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "cost_annual" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "effort_hours" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "cost_currency" varchar(3) DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "budget_id" uuid REFERENCES "grc_budget"("id"),
  ADD COLUMN IF NOT EXISTS "cost_note" text;

CREATE INDEX IF NOT EXISTS "control_budget_idx" ON "control" ("budget_id");

-- ──────────────────────────────────────────────────────────────
-- 5. Cost fields on risk_treatment table (expand existing)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "risk_treatment"
  ADD COLUMN IF NOT EXISTS "cost_annual" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "effort_hours" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "cost_currency" varchar(3) DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "budget_id" uuid REFERENCES "grc_budget"("id"),
  ADD COLUMN IF NOT EXISTS "cost_note" text;

CREATE INDEX IF NOT EXISTS "risk_treatment_budget_idx" ON "risk_treatment" ("budget_id");

-- ──────────────────────────────────────────────────────────────
-- 6. Cost fields on dpia_measure table
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "dpia_measure"
  ADD COLUMN IF NOT EXISTS "cost_onetime" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "cost_annual" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "effort_hours" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "cost_currency" varchar(3) DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "budget_id" uuid REFERENCES "grc_budget"("id"),
  ADD COLUMN IF NOT EXISTS "cost_note" text;

CREATE INDEX IF NOT EXISTS "dpia_measure_budget_idx" ON "dpia_measure" ("budget_id");

-- ──────────────────────────────────────────────────────────────
-- 7. Cost fields on continuity_strategy table (expand existing)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "continuity_strategy"
  ADD COLUMN IF NOT EXISTS "effort_hours" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "cost_currency" varchar(3) DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "budget_id" uuid REFERENCES "grc_budget"("id"),
  ADD COLUMN IF NOT EXISTS "cost_note" text;

CREATE INDEX IF NOT EXISTS "continuity_strategy_budget_idx" ON "continuity_strategy" ("budget_id");

-- ──────────────────────────────────────────────────────────────
-- 8. Aggregation view — budget usage summary
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW "v_budget_usage" AS
WITH entity_costs AS (
  -- Controls
  SELECT org_id, budget_id,
    COALESCE(cost_onetime, 0) AS cost_onetime,
    COALESCE(cost_annual, 0) AS cost_annual,
    COALESCE(effort_hours, 0) AS effort_hours,
    'control' AS entity_type
  FROM "control" WHERE budget_id IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  -- Risk treatments
  SELECT org_id, budget_id,
    COALESCE(cost_estimate, 0) AS cost_onetime,
    COALESCE(cost_annual, 0) AS cost_annual,
    COALESCE(effort_hours, 0) AS effort_hours,
    'risk_treatment' AS entity_type
  FROM "risk_treatment" WHERE budget_id IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  -- DPIA measures
  SELECT org_id, budget_id,
    COALESCE(cost_onetime, 0) AS cost_onetime,
    COALESCE(cost_annual, 0) AS cost_annual,
    COALESCE(effort_hours, 0) AS effort_hours,
    'dpia_measure' AS entity_type
  FROM "dpia_measure" WHERE budget_id IS NOT NULL
  UNION ALL
  -- Continuity strategies
  SELECT org_id, budget_id,
    COALESCE(estimated_cost_eur, 0) AS cost_onetime,
    COALESCE(annual_cost_eur, 0) AS cost_annual,
    COALESCE(effort_hours, 0) AS effort_hours,
    'continuity_strategy' AS entity_type
  FROM "continuity_strategy" WHERE budget_id IS NOT NULL
)
SELECT
  b.id AS budget_id,
  b.org_id,
  b.name AS budget_name,
  b.budget_type,
  b.grc_area,
  b.total_amount AS planned_amount,
  b.currency,
  COALESCE(SUM(ec.cost_onetime), 0) AS total_onetime,
  COALESCE(SUM(ec.cost_annual), 0) AS total_annual,
  COALESCE(SUM(ec.effort_hours), 0) AS total_effort_hours,
  COALESCE(SUM(ec.cost_onetime), 0) + COALESCE(SUM(ec.cost_annual), 0) AS total_used,
  b.total_amount - (COALESCE(SUM(ec.cost_onetime), 0) + COALESCE(SUM(ec.cost_annual), 0)) AS remaining,
  COUNT(ec.*) AS entity_count
FROM "grc_budget" b
LEFT JOIN entity_costs ec ON ec.budget_id = b.id
GROUP BY b.id, b.org_id, b.name, b.budget_type, b.grc_area, b.total_amount, b.currency;
