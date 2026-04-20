-- Migration 0288: RLS gap closure v3 (ADR-001 enforcement)
--
-- The rls-audit systemtest still flagged 11 tenant-scoped tables
-- without RLS enabled, all of them added after 0286 ran or missed by
-- it (AI-Act v2 tables from 0085_ai_act_complete.sql and the
-- phase-2 analytics tables from 0099_phase2_missing_tables.sql).
--
-- Same policy shape as 0286:
--   USING      (org_id = current_setting('app.current_org_id')::uuid)
--   WITH CHECK (org_id = current_setting('app.current_org_id')::uuid)
-- plus FORCE so the table owner (`grc`) cannot bypass RLS when an
-- admin accidentally runs a migration tool as the owner role.

DO $BODY$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'ai_conformity_assessment',
    'ai_framework_mapping',
    'ai_fria',
    'ai_human_oversight_log',
    'ai_system',
    'ai_transparency_entry',
    'audit_risk_prediction',
    'audit_risk_prediction_model',
    'process_simulation_result',
    'scenario_engine_scenario',
    'simulation_run_result'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    -- Skip tables that aren't present on this environment (e.g. Hetzner
    -- released without a particular module's migrations applied yet).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'Skipping %: table does not exist on this environment', tbl;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'org_id'
    ) THEN
      RAISE NOTICE 'Skipping %: table has no org_id column', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      tbl || '_tenant_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (org_id = current_setting(''app.current_org_id'', true)::uuid)',
      tbl || '_tenant_select', tbl
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      tbl || '_tenant_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (org_id = current_setting(''app.current_org_id'', true)::uuid)',
      tbl || '_tenant_insert', tbl
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      tbl || '_tenant_update', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (org_id = current_setting(''app.current_org_id'', true)::uuid) WITH CHECK (org_id = current_setting(''app.current_org_id'', true)::uuid)',
      tbl || '_tenant_update', tbl
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      tbl || '_tenant_delete', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (org_id = current_setting(''app.current_org_id'', true)::uuid)',
      tbl || '_tenant_delete', tbl
    );
  END LOOP;
END;
$BODY$;
