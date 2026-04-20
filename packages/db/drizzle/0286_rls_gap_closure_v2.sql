-- Migration 0286: RLS gap closure (v2, after rls-audit)
--
-- The rls-audit module (ADR-001 enforcement check) reported 29 tenant-
-- scoped tables without ROW LEVEL SECURITY enabled and 383 tables where
-- RLS was on but not FORCED. This migration closes both gaps.
--
-- What FORCE RLS does: without it, the table's owner (role `grc`)
-- bypasses RLS. The app connects as `grc_app` (not owner) so the
-- practical leak surface is small today, but defense-in-depth is a
-- first-line-of-defense property that has to hold even when someone
-- accidentally runs a migration tool as the owner role.
--
-- The policies below all share the same shape:
--   USING (org_id = current_setting('app.current_org_id')::uuid)
-- which is the ADR-001 pattern. `app.current_org_id` is set by the
-- auth middleware before any query runs; an unset or empty value
-- makes the USING clause fail silently (no rows visible), which is
-- the safe default.

-- ──────────────────────────────────────────────────────────────
-- Part A — tables WITHOUT any RLS at all: enable + policies + force
-- ──────────────────────────────────────────────────────────────

DO $BODY$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'attestation_campaign',
    'audit_sample',
    'board_report',
    'checklist_instance',
    'checklist_template',
    'connector_instance',
    'connector_sync_log',
    'consolidation_entry',
    'consolidation_group',
    'content_placeholder',
    'content_request',
    'control_monitoring_result',
    'control_monitoring_rule',
    'data_lineage_entry',
    'data_lineage_source',
    'data_link',
    'data_validation_result',
    'data_validation_rule',
    'esef_filing',
    'evidence_request',
    'inline_comment',
    'messaging_integration',
    'narrative_instance',
    'narrative_template',
    'reminder_rule',
    'report_template',
    'review_cycle',
    'sox_scoping',
    'xbrl_tagging_instance'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    -- Only touch tables that actually exist and have an org_id column.
    -- If they don't, quietly skip — the rls-audit will catch it next run.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=tbl
    ) THEN
      RAISE NOTICE 'Skipping % — table does not exist', tbl;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=tbl AND column_name='org_id'
    ) THEN
      RAISE NOTICE 'Skipping % — no org_id column (not tenant-scoped)', tbl;
      CONTINUE;
    END IF;

    -- Enable RLS + FORCE
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    -- Drop old policies if this migration is being re-run
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_write  ON %I', tbl, tbl);

    -- Create SELECT policy
    EXECUTE format($$
      CREATE POLICY %I_tenant_select ON %I
      FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    $$, tbl, tbl);

    -- Create INSERT / UPDATE / DELETE policy (single "ALL" policy)
    EXECUTE format($$
      CREATE POLICY %I_tenant_write ON %I
      FOR ALL
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    $$, tbl, tbl);

    RAISE NOTICE 'Secured %', tbl;
  END LOOP;
END
$BODY$;

-- ──────────────────────────────────────────────────────────────
-- Part B — FORCE RLS on every tenant-scoped table that has RLS
-- enabled but not forced. Idempotent: re-running costs nothing.
-- ──────────────────────────────────────────────────────────────

DO $BODY$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true       -- RLS on
      AND c.relforcerowsecurity = false -- but not forced
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=c.relname AND column_name='org_id'
      )
      -- Exceptions: these tables are intentionally accessed as owner
      -- (log tables read by the integrity check; see rls-audit.ts
      -- TENANT_TABLE_RLS_EXCEPTIONS).
      AND c.relname NOT IN ('audit_log', 'access_log', 'data_export_log',
                            'notification', 'audit_anchor')
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    RAISE NOTICE 'FORCED RLS on %', tbl;
  END LOOP;
END
$BODY$;
