-- Migration: Add target_modules to all catalog tables for management-system filtering
-- Allows catalogs to declare which management systems they target
-- Used by per-module filtered catalog views in the sidebar

-- ──────────────────────────────────────────────────────────────
-- 1. Add target_modules to generic catalog table (used by seed data)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "catalog"
  ADD COLUMN IF NOT EXISTS "target_modules" text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "catalog_modules_idx"
  ON "catalog" USING GIN ("target_modules");

-- ──────────────────────────────────────────────────────────────
-- 2. Add target_modules to risk_catalog (Drizzle typed table)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "risk_catalog"
  ADD COLUMN IF NOT EXISTS "target_modules" text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "risk_catalog_modules_idx"
  ON "risk_catalog" USING GIN ("target_modules");

-- ──────────────────────────────────────────────────────────────
-- 3. Add target_modules to control_catalog (Drizzle typed table)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "control_catalog"
  ADD COLUMN IF NOT EXISTS "target_modules" text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "control_catalog_modules_idx"
  ON "control_catalog" USING GIN ("target_modules");

-- ──────────────────────────────────────────────────────────────
-- 4. Backfill target_modules for existing seed catalogs
-- ──────────────────────────────────────────────────────────────

-- Generic catalog table backfills
UPDATE "catalog" SET "target_modules" = '{erm,isms,bcms}' WHERE "source" = 'cambridge_taxonomy_v2';
UPDATE "catalog" SET "target_modules" = '{erm}' WHERE "source" = 'wef_global_risks_2025';
UPDATE "catalog" SET "target_modules" = '{isms,ics}' WHERE "source" = 'iso_27002_2022';
UPDATE "catalog" SET "target_modules" = '{isms,ics,erm}' WHERE "source" = 'nist_csf_2';
UPDATE "catalog" SET "target_modules" = '{isms,ics}' WHERE "source" = 'cis_controls_v8';
UPDATE "catalog" SET "target_modules" = '{isms}' WHERE "source" = 'bsi_itgs_elementar';
UPDATE "catalog" SET "target_modules" = '{isms}' WHERE "source" = 'arctos_incident_taxonomy';
UPDATE "catalog" SET "target_modules" = '{bcms}' WHERE "source" = 'arctos_crisis_templates';
UPDATE "catalog" SET "target_modules" = '{tprm}' WHERE "source" = 'arctos_dd_template';
UPDATE "catalog" SET "target_modules" = '{tprm}' WHERE "source" = 'arctos_lksg';
UPDATE "catalog" SET "target_modules" = '{dpms}' WHERE "source" = 'arctos_dpia_criteria';

-- Typed table backfills (risk_catalog / control_catalog)
UPDATE "risk_catalog" SET "target_modules" = '{erm,isms,bcms}' WHERE "source" = 'cambridge_taxonomy_v2';
UPDATE "risk_catalog" SET "target_modules" = '{erm}' WHERE "source" = 'wef_global_risks_2025';
UPDATE "risk_catalog" SET "target_modules" = '{isms}' WHERE "source" = 'bsi_threats';
UPDATE "control_catalog" SET "target_modules" = '{isms,ics}' WHERE "source" = 'iso_27002_2022';
UPDATE "control_catalog" SET "target_modules" = '{isms,ics,erm}' WHERE "source" = 'nist_csf_2';
UPDATE "control_catalog" SET "target_modules" = '{isms,ics}' WHERE "source" = 'cis_controls_v8';
