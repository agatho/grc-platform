-- #WAVE23.5: backfill the missing `report_template` column on org_branding.
--
-- Discovered during Wave-23 live A2 verification (2026-05-17): every GET
-- /api/v1/admin/branding on prod returned HTTP 500 with the underlying
-- error "Failed query: select ... 'report_template' ... from
-- 'org_branding'". The Drizzle schema (packages/db/src/schema/branding.ts)
-- declares the column, and migration 0024_sprint13a_branding.sql includes
-- it in the original CREATE TABLE. But prod's `\d org_branding` shows the
-- column is missing.
--
-- Most likely sequence:
--   1. Prod ran an early version of 0024 that didn't include
--      `report_template` → table created without the column.
--   2. The column was added to 0024 later in the source tree.
--   3. Migrate-all re-running 0024 fails silently on "table already
--      exists" (CREATE TABLE without IF NOT EXISTS) — the new column
--      definition never reaches the running table.
--
-- This migration is the corrective ALTER. It's idempotent
-- (IF NOT EXISTS guards on both the enum and the column), so it's
-- safe to apply on any DB:
--   - Fresh DB (post-0024 with column): no-op
--   - Drift DB (column missing): adds the column with the same enum
--     type and default the schema declares
--
-- After this lands + arctos-update + recreate: GET /admin/branding
-- returns 200 with defaults instead of 500.

-- 1. Ensure the enum type exists (might also have drifted off).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branding_template_style') THEN
    CREATE TYPE branding_template_style AS ENUM ('standard', 'formal', 'minimal');
  END IF;
END $$;

-- 2. Add the column if missing.
ALTER TABLE org_branding
  ADD COLUMN IF NOT EXISTS report_template branding_template_style
    NOT NULL DEFAULT 'standard';

-- 3. Diagnostic NOTICE for the deploy log.
DO $$
DECLARE
  col_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_branding'
      AND column_name = 'report_template'
  ) INTO col_exists;
  IF col_exists THEN
    RAISE NOTICE '[migration 0329] org_branding.report_template column present (post-migration)';
  ELSE
    RAISE WARNING '[migration 0329] org_branding.report_template still missing — manual investigation needed';
  END IF;
END $$;
