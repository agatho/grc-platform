-- Migration 0342: Backfill UPDATE/DELETE RLS policies on audit_sign_off
-- and vendor_sign_off.
--
-- Background: the RLS coverage system test (tests/rls/rls-coverage-systemtest)
-- requires every tenant-scoped table to declare policies for all four
-- commands (SELECT, INSERT, UPDATE, DELETE). Migration 0336 dynamically
-- swept the schema and added the missing UPDATE/DELETE policies on every
-- pre-existing table (including process_sign_off).
--
-- audit_sign_off (0338) and vendor_sign_off (0340) were created *after*
-- 0336 ran. The sweep does not re-run, so these two tables ship with only
-- SELECT + INSERT policies. The coverage test flags them as
-- "missing_policies" and the integration job fails.
--
-- These tables are append-only by design — the application never issues
-- UPDATE or DELETE. Adding tenant-isolation policies for those commands
-- is harmless (no app code triggers them) and brings these tables into
-- parity with process_sign_off, which the same test accepts.

BEGIN;

-- audit_sign_off ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_sign_off'
      AND policyname = 'audit_sign_off_tenant_update'
  ) THEN
    CREATE POLICY audit_sign_off_tenant_update ON audit_sign_off
      FOR UPDATE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_sign_off'
      AND policyname = 'audit_sign_off_tenant_delete'
  ) THEN
    CREATE POLICY audit_sign_off_tenant_delete ON audit_sign_off
      FOR DELETE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

-- vendor_sign_off ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vendor_sign_off'
      AND policyname = 'vendor_sign_off_tenant_update'
  ) THEN
    CREATE POLICY vendor_sign_off_tenant_update ON vendor_sign_off
      FOR UPDATE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vendor_sign_off'
      AND policyname = 'vendor_sign_off_tenant_delete'
  ) THEN
    CREATE POLICY vendor_sign_off_tenant_delete ON vendor_sign_off
      FOR DELETE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

COMMIT;
