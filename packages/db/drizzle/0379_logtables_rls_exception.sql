-- ============================================================================
-- Migration 0379: Log-Tabellen dauerhaft RLS-frei stellen (F-01-Folgefix)
--
-- KONTEXT (Pentest F-01, auf dem Prod-Testserver diagnostiziert)
-- ---------------------------------------------------------------------------
-- Nach der Umstellung der App-Runtime auf die Nicht-Superuser-Rolle `grc_app`
-- (Pentest-Fund F-01) schlug JEDER Login mit
--
--     new row violates row-level security policy for table "access_log"
--     (SQLSTATE 42501)
--
-- fehl. Ursache: Der Login-Flow (packages/auth/src/providers.ts,
-- logAccessEvent) schreibt beim Login eine Zeile in `access_log` OHNE
-- org-Kontext (org_id = NULL) — beim Login steht die Org noch nicht fest.
-- Unter dem alten Superuser wurde RLS umgangen; unter `grc_app` greift die
-- Policy und der org-lose INSERT scheitert am WITH CHECK.
--
-- Diese fünf Tabellen stehen BEWUSST in der RLS-Ausnahme-Whitelist
-- `TENANT_TABLE_RLS_EXCEPTIONS` (packages/db/src/rls-audit.ts): es sind
-- Append-only-Log-/Anchor-Tabellen, die org-los vom Auth- bzw. Worker-Flow
-- beschrieben werden und server-seitig über org_id gefiltert werden. Sie
-- dürfen KEIN RLS tragen. Ihre Mandantentrennung + Integrität sichern sie
-- über App-Level-Filter, den SHA-256-Hash-Chain und Append-only-RULES/Trigger
-- — NICHT über RLS.
--
-- WIE KAM ES ZUM RLS AUF DIESEN TABELLEN?
--   * 0000_lethal_scorpion.sql   → RLS + Policy `org_isolation` auf
--                                  audit_log, data_export_log, notification.
--   * 0315_rls_gap_closure_v4.sql→ RLS + 4 `_tenant_*`-Policies auf
--                                  audit_anchor (trotz Whitelist mitgezogen).
--   * 0336_rls_gap_closure_v5.sql→ DYNAMISCHER Sweep über JEDE Tabelle mit
--                                  org_id-Spalte OHNE Log-Tabellen-Ausnahme.
--   * 0378_access_log_org_id.sql → gab access_log eine org_id-Spalte
--                                  (nullable, bewusst KEIN FORCE) und machte
--                                  sie damit zum Kandidaten des dyn. Sweeps;
--                                  ein erneuter Sweep (Deploy-ensure-RLS)
--                                  vergab dann die org-Policy, die den Login
--                                  brach.
--
-- FIX: Für jede der fünf Whitelist-Tabellen alle RLS-Policies droppen und RLS
-- explizit DISABLE + NO FORCE setzen. Damit überschreibt diese Migration die
-- verursachenden Migrationen sauber und macht die Whitelist auf DB-Ebene wahr.
--
-- WICHTIG: NUR RLS wird angefasst. Die Append-only-Garantien
-- (`*_no_update`/`*_no_delete`-RULES, audit_trigger, Hash-Kette) sind RULES
-- bzw. Trigger — KEIN RLS — und bleiben unangetastet.
--
-- Idempotent: to_regclass-Guard je Tabelle, DROP POLICY IF EXISTS,
-- DISABLE/NO FORCE sind No-ops bei bereits deaktiviertem RLS. Mehrfache
-- Anwendung ist fehlerfrei.
-- ============================================================================

DO $BODY$
DECLARE
  tbl  text;
  pol  record;
  log_tables text[] := ARRAY[
    'audit_log',
    'access_log',
    'data_export_log',
    'notification',
    'audit_anchor'
  ];
BEGIN
  FOREACH tbl IN ARRAY log_tables LOOP
    -- Nur existierende Tabellen anfassen (Dev-DB kann hinterherhinken).
    IF to_regclass('public.' || quote_ident(tbl)) IS NULL THEN
      RAISE NOTICE '[0379] Überspringe % — Tabelle existiert nicht', tbl;
      CONTINUE;
    END IF;

    -- 1) Alle vorhandenen RLS-Policies dieser Tabelle droppen (dynamisch, egal
    --    wie sie heißen: org_isolation, <tbl>_tenant_select/_insert/... etc.).
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      RAISE NOTICE '[0379] Policy % auf % gedroppt', pol.policyname, tbl;
    END LOOP;

    -- 2) RLS deaktivieren + FORCE zurücknehmen. Beides No-op, falls bereits so.
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', tbl);
    RAISE NOTICE '[0379] % → RLS disabled + no force', tbl;
  END LOOP;
END
$BODY$;
