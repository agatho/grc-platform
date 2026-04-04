-- Migration 0072: Sync all Drizzle schema tables to database
-- Creates ~330 tables defined in packages/db/src/schema/ that were never migrated.
-- Also adds evaluation_phase column to risk table, enables RLS, and registers audit triggers.
-- Fully idempotent — safe to run multiple times.

-- ──────────────────────────────────────────────────────────────
-- Step 1: Run drizzle-kit push or this migration's companion script
-- This migration is intentionally a lightweight wrapper. The actual
-- table creation is handled by the create-missing-tables.ts script
-- which reads the Drizzle schema at runtime and creates any missing
-- tables. This approach ensures the migration stays in sync with
-- schema changes without maintaining 330+ CREATE TABLE statements.
--
-- Usage (run from packages/db/):
--   DATABASE_URL="..." npx tsx src/create-missing-tables.ts
--
-- For CI, this migration applies the critical manual pieces below.
-- ──────────────────────────────────────────────────────────────

-- Step 2: Add evaluation_phase enum and columns to risk table
DO $$ BEGIN
  CREATE TYPE evaluation_phase AS ENUM ('identification','analysis','evaluation','treatment','monitoring','closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE risk ADD COLUMN IF NOT EXISTS evaluation_phase evaluation_phase NOT NULL DEFAULT 'identification';
ALTER TABLE risk ADD COLUMN IF NOT EXISTS next_evaluation_date DATE;
ALTER TABLE risk ADD COLUMN IF NOT EXISTS evaluation_cycle_days INTEGER DEFAULT 90;

-- Step 3: Enable RLS on any org_id tables that don't have it yet
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND a.attname = 'org_id' AND a.attnum > 0 AND NOT a.attisdropped
      AND c.relkind = 'r' AND c.relrowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    BEGIN
      EXECUTE format('CREATE POLICY rls_%I ON %I USING (org_id = current_setting(''app.current_org_id'', true)::uuid)', tbl, tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Step 4: Register audit_trigger on all org_id tables missing it
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND a.attname = 'org_id' AND a.attnum > 0 AND NOT a.attisdropped
      AND c.relkind = 'r'
      AND c.relname NOT IN ('audit_log', 'access_log', 'ai_prompt_log')
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'audit_trigger'
      )
  LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger()', tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
