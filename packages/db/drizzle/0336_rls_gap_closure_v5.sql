-- Migration 0336: RLS gap closure v5 (post-Wave 23, BPM overhaul follow-up).
--
-- Strategy: dynamic sweep. For every public schema table that has an `org_id`
-- column and is NOT a known platform-exempt table, ensure RLS is enabled +
-- forced, and ensure the four standard tenant policies exist. Idempotent and
-- safe — it never alters policies that already exist with different names
-- (CREATE POLICY is guarded by NOT EXISTS).
--
-- This complements 0315 (which static-listed ~142 tables) by catching anything
-- added since (process_ropa_profile, process_sign_off, process_framework_mapping,
-- plus future tables).

BEGIN;

DO $$
DECLARE
  r record;
  policy_count int;
  table_count int := 0;
  policies_added int := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'  -- ordinary tables only
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = c.relname
          AND column_name = 'org_id'
      )
      AND c.relname NOT IN (
        -- Platform-exempt: see rls-audit doc
        'organization',
        'user',
        'session',
        'account',
        'verification_token',
        'module_definition',
        'process_template',
        'process_maturity_questionnaire',
        'catalog',
        'catalog_entry',
        'risk_catalog',
        'risk_catalog_entry',
        'control_catalog',
        'control_catalog_entry',
        'catalog_entry_mapping',
        'framework_mapping'
      )
  LOOP
    -- Enable + force RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tbl);
    table_count := table_count + 1;

    -- SELECT policy
    SELECT COUNT(*) INTO policy_count FROM pg_policies
      WHERE schemaname='public' AND tablename=r.tbl AND policyname = r.tbl || '_tenant_select';
    IF policy_count = 0 THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT USING (org_id = NULLIF(current_setting(''app.current_org_id'', true), '''')::uuid)',
        r.tbl || '_tenant_select', r.tbl
      );
      policies_added := policies_added + 1;
    END IF;

    -- INSERT policy
    SELECT COUNT(*) INTO policy_count FROM pg_policies
      WHERE schemaname='public' AND tablename=r.tbl AND policyname = r.tbl || '_tenant_insert';
    IF policy_count = 0 THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', true), '''')::uuid)',
        r.tbl || '_tenant_insert', r.tbl
      );
      policies_added := policies_added + 1;
    END IF;

    -- UPDATE policy
    SELECT COUNT(*) INTO policy_count FROM pg_policies
      WHERE schemaname='public' AND tablename=r.tbl AND policyname = r.tbl || '_tenant_update';
    IF policy_count = 0 THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR UPDATE USING (org_id = NULLIF(current_setting(''app.current_org_id'', true), '''')::uuid) WITH CHECK (org_id = NULLIF(current_setting(''app.current_org_id'', true), '''')::uuid)',
        r.tbl || '_tenant_update', r.tbl
      );
      policies_added := policies_added + 1;
    END IF;

    -- DELETE policy
    SELECT COUNT(*) INTO policy_count FROM pg_policies
      WHERE schemaname='public' AND tablename=r.tbl AND policyname = r.tbl || '_tenant_delete';
    IF policy_count = 0 THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE USING (org_id = NULLIF(current_setting(''app.current_org_id'', true), '''')::uuid)',
        r.tbl || '_tenant_delete', r.tbl
      );
      policies_added := policies_added + 1;
    END IF;
  END LOOP;
  RAISE NOTICE '[0336] RLS sweep: % tables enforced, % new policies added', table_count, policies_added;
END $$;

COMMIT;
