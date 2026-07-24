-- ============================================================================
-- Migration 0378: access_log.org_id — Mandantenbezug für den Access-Log
--
-- Pentest-Fund F-03 (MEDIUM): GET /api/v1/access-log lieferte jedem Org-admin
-- Login-Versuche/IPs/E-Mails ALLER Mandanten, weil access_log keine org_id
-- besaß und die Route ungefiltert `SELECT * FROM access_log` machte.
--
-- Fix: org_id (nullable) ergänzen. access_log ist — wie audit_log,
-- data_export_log und notification — eine Append-only-Log-Tabelle, die
-- server-seitig über org_id gefiltert wird und BEWUSST in der RLS-Ausnahme-
-- Whitelist steht (packages/db/src/rls-audit.ts TENANT_TABLE_RLS_EXCEPTIONS,
-- Migration 0286). Deshalb hier KEIN `FORCE ROW LEVEL SECURITY`:
--
--   1. Die Zeilen werden vom Auth-Flow OHNE org-Kontext geschrieben
--      (logAccessEvent läuft vor/ohne app.current_org_id). Eine FORCE-Policy
--      mit `WITH CHECK (org_id = current_setting('app.current_org_id'))`
--      würde jeden Login-Insert brechen.
--   2. Fehlgeschlagene Logins unbekannter E-Mails / Multi-Org-User bleiben
--      org-los (org_id = NULL) und sind damit für keinen einzelnen Org-admin
--      sichtbar — die Route filtert `org_id = <caller org>` und schließt
--      NULL implizit aus. Das ist exakt das gewünschte Verhalten aus F-03.
--
-- org_id wird server-seitig in logAccessEvent (packages/auth/src/providers.ts)
-- befüllt, sobald der User eindeutig einer einzigen Org zugeordnet ist.
--
-- Spiegelt das bestehende Muster von audit_log.org_id (nullable, kein FORCE).
-- Idempotent: IF NOT EXISTS überall.
-- ============================================================================

DO $$ BEGIN
  -- 1) Spalte (nullable — org-los erlaubt für Pre-Auth-/Unknown-User-Events)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'access_log'
      AND column_name = 'org_id'
  ) THEN
    EXECUTE 'ALTER TABLE access_log ADD COLUMN org_id uuid';
    -- FK auf organization — ON DELETE SET NULL, damit ein Org-Löschen die
    -- historischen Log-Zeilen nicht mitreißt (Append-only-Charakter wahren).
    BEGIN
      EXECUTE 'ALTER TABLE access_log
                 ADD CONSTRAINT access_log_org_id_organization_id_fk
                 FOREIGN KEY (org_id) REFERENCES organization(id)
                 ON DELETE SET NULL';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;

  -- 2) Index für die org-gefilterte, zeitlich sortierte Route-Query.
  -- Name bewusst NICHT "acl_org_idx" — der ist bereits von audit_checklist
  -- belegt (Migration 0017); Index-Namen sind in Postgres schema-global.
  EXECUTE 'CREATE INDEX IF NOT EXISTS access_log_org_idx ON access_log(org_id, created_at)';

  EXECUTE 'COMMENT ON COLUMN access_log.org_id IS '
    || quote_literal('Mandant des aufgelösten Users (F-03). NULL = org-los (Login-Versuch unbekannter E-Mail oder Multi-Org-User) — wird NICHT an Org-admins ausgeliefert, die Route filtert org_id = <caller org>. Append-only-Log: KEIN RLS-FORCE (siehe Migration 0378-Header + rls-audit.ts).');
END $$;
