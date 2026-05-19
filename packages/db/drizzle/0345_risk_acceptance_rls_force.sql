-- Migration: harden RLS on risk_acceptance + risk_acceptance_authority + erm_sync_config
--
-- Triage finding F#27 (overnight 2026-05-18): the existing policies on
-- these three tables (migrations 0088 + 0105) had two gaps:
--
-- 1. No FORCE ROW LEVEL SECURITY. PostgreSQL bypasses RLS for the table
--    owner by default, which is acceptable for a CRUD-via-API model but
--    leaves any direct `psql` session as the owner role able to read
--    every org. FORCE closes that hole.
--
-- 2. The policy uses `USING (...)` only. `USING` controls visibility on
--    SELECT/DELETE and the row-existence check on UPDATE — but it does
--    NOT guard the NEW row in an INSERT or in the post-image of an
--    UPDATE. Without a `WITH CHECK` clause, an INSERT with a forged
--    org_id can land. Defence-in-depth: add WITH CHECK alongside USING.
--
-- Pattern matches the standard used by migration 0336 (RLS gap closure
-- v5) and 0342 (sign-off tables) — both already use FORCE + WITH CHECK.

DO $$ BEGIN
  EXECUTE 'ALTER TABLE risk_acceptance FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE risk_acceptance_authority FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE erm_sync_config FORCE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FORCE RLS already applied or table missing: %', SQLERRM;
END $$;

-- Drop & recreate policies with both USING and WITH CHECK. Drop is
-- idempotent via DROP POLICY IF EXISTS.
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS rls_risk_acceptance ON risk_acceptance';
  EXECUTE 'CREATE POLICY rls_risk_acceptance ON risk_acceptance ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'risk_acceptance policy refresh: %', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS rls_risk_acceptance_authority ON risk_acceptance_authority';
  EXECUTE 'CREATE POLICY rls_risk_acceptance_authority ON risk_acceptance_authority ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'risk_acceptance_authority policy refresh: %', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS rls_erm_sync_config ON erm_sync_config';
  EXECUTE 'CREATE POLICY rls_erm_sync_config ON erm_sync_config ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'erm_sync_config policy refresh: %', SQLERRM;
END $$;
