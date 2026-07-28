-- 0381_notification_dataexport_rls.sql
--
-- Pentest v2 follow-up (RLS-Coverage-Audit): von 498 org_id-Tabellen waren 493
-- voll RLS-abgesichert (ENABLE+FORCE+Policy). Die 5 Ausnahmen aus
-- 0379_logtables_rls_exception.sql sind app-seitig org-gefiltert (kein akutes
-- Leck), aber ohne RLS-Zweitlinie. Diese Migration stellt die RLS-Zweitlinie
-- fuer die ZWEI Tabellen wieder her, bei denen das nachweislich risikofrei ist:
--
--   * notification     — per-user + per-org, immer MIT passender org_id
--                        geschrieben (org_id = ctx.orgId), kein Pre-Auth-Pfad.
--   * data_export_log  — post-auth, single-org, immer MIT org_id geschrieben.
--
-- Beide inserten NIE org-los (org_id ist nie NULL) — anders als access_log —,
-- daher ist die Standard-FOR-ALL-Policy (identisch zu den 493 bereits
-- abgesicherten Tenant-Tabellen) hier korrekt: INSERT/UPDATE traegt org_id =
-- ctx.orgId == current_setting('app.current_org_id'), passiert also die
-- WITH-CHECK; SELECT/UPDATE/DELETE sind auf die eigene Org beschraenkt.
-- Worker/Migrations laufen als Superuser grc und umgehen RLS wie gehabt.
--
-- BEWUSST WEITER OHNE RLS (siehe 0379 + rls-audit.ts):
--   * access_log       — beim Login ORG-LOS geschrieben (org_id NULL) und vom
--                        Auth-/Rate-Limit-Flow zurueckgelesen; per-org-Policy
--                        wuerde Login/Brute-Force-Schutz brechen (F-01).
--   * audit_log / audit_anchor — ueber die Org-HIERARCHIE gelesen (Descendant-
--                        Scope der Audit-Route) und vom Plattform-Integritaets-
--                        Check; per-org-Policy wuerde legitim sichtbare Zeilen
--                        verstecken.
--
-- Idempotent: to_regclass-Guard + DROP POLICY IF EXISTS. migrate-all.ts re-runt
-- alle Files jeden Deploy; 0381 sortiert nach 0379, gewinnt also die Endzustands-
-- Reihenfolge (0379 disable -> 0381 enable).

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['notification', 'data_export_log'] LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_org_isolation', tbl);
    -- Standard tenant policy (FOR ALL): identical shape to the 493 covered
    -- tables. USING scopes SELECT/UPDATE/DELETE to the request org; the
    -- implicit WITH CHECK (= USING) scopes INSERT/UPDATE writes to it too.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I USING (org_id::text = current_setting(''app.current_org_id'', true))',
      tbl || '_org_isolation', tbl);
  END LOOP;
END $$;
