-- Migration 0337: Audit trigger gap closure (BPM overhaul Phase 2 B2).
--
-- Per STATUS.md ~52 tables have RLS but lack the audit_trigger(). Register
-- audit_trigger() dynamically on every public table that has an org_id
-- column and is not already triggered.
--
-- The audit_trigger function emits an entry per row change into audit_log;
-- the hash-chain is forwarded by the existing chain dispatch.

BEGIN;

DO $$
DECLARE
  r record;
  has_trigger boolean;
  total_added int := 0;
BEGIN
  -- Bail gracefully if the function is missing on this DB
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    RAISE NOTICE '[0337] audit_trigger() not present — skipping registration';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = c.relname
          AND column_name = 'org_id'
      )
      AND c.relname NOT IN (
        -- Skip platform-exempt + audit-log itself (would recurse)
        'organization',
        'user',
        'session',
        'account',
        'audit_log',
        'access_log',
        'data_export_log',
        'notification',
        'process_event',  -- volume — already domain-specific
        'process_event_log'
      )
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || quote_ident(r.tbl))::regclass
        AND tgname = r.tbl || '_audit_trigger'
        AND NOT tgisinternal
    ) INTO has_trigger;

    IF NOT has_trigger THEN
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger()',
        r.tbl || '_audit_trigger', r.tbl
      );
      total_added := total_added + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '[0337] audit trigger sweep: % triggers added', total_added;
END $$;

COMMIT;
