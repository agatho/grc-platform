-- Migration 0395: FORCE RLS flächendeckend, deny-all-Lücke und WB-Log-Policy
--
-- Migration: 0395_rls_force_and_policy_gaps
-- Breaking: no
-- Estimated-Duration: 10
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-12(b), S01-17, S01-19, S01-20]
--
-- --------------------------------------------------------------------------
-- 1. S01-20 / S01-12(b): FORCE ROW LEVEL SECURITY
-- --------------------------------------------------------------------------
-- 15 Tabellen mit aktivem RLS trugen kein FORCE (gemessen nach WP1 gegen eine
-- migrationsgebaute DB; das Audit sah 10, die zusätzlichen fünf existierten
-- vorher gar nicht, weil ihre Migrationen scheiterten). Ohne FORCE umgeht der
-- Tabelleneigentümer seine eigenen Policies. Heute ist der Eigentümer `grc`
-- ohnehin Superuser, das ändert also nichts — es wird in dem Moment relevant,
-- in dem der Eigentümer auf eine Nicht-Superuser-Rolle umgestellt wird (die
-- empfohlene Härtung) oder eine privilegierte Komponente als Eigentümer
-- arbeitet.
--
-- Darunter `organization`, die Mandanten-Wurzeltabelle: für sie war FORCE als
-- #SEC-F09 bereits einmal gefixt — aber nur in `deploy/provision-grc-app.sh`,
-- also NICHT in einer Migration (S01-12b). Jede migrationsgebaute Datenbank
-- (CI, DR-Restore, neue Region, lokale Entwicklung) hatte
-- `relforcerowsecurity = false` auf der Wurzeltabelle. Diese Migration holt
-- das ins versionierte Schema; das Shell-Skript darf es weiterhin tun, es ist
-- dann ein No-Op.
--
-- Katalog-getrieben statt Namensliste: JEDE Tabelle in `public` mit aktivem
-- RLS bekommt FORCE. Das ist die richtige Richtung — eine Tabelle, für die
-- RLS eingeschaltet wurde, soll sie auch gegen den Eigentümer durchsetzen.
--
-- --------------------------------------------------------------------------
-- 2. S01-19: `notification_preference` — RLS an, null Policies
-- --------------------------------------------------------------------------
-- RLS aktiviert, kein FORCE, KEINE Policy. Unter `grc_app` (nicht Eigentümer)
-- wirkt das als vollständiges Verbot: Benachrichtigungseinstellungen sind im
-- Produktivbetrieb funktionslos, während sie unter der Superuser-
-- Konfiguration (Dev/CI) einwandfrei arbeiten — ein Defekt, der genau nur in
-- der abgesicherten Umgebung auftritt.
--
-- Die Tabelle hat keine `org_id`, wohl aber `user_id` (NOT NULL). Die
-- fachlich richtige Isolation ist deshalb nutzer-, nicht org-bezogen: jeder
-- sieht und pflegt seine eigenen Einstellungen. `app.current_user_id` wird
-- von `reserveRequestContext` bei jedem authentifizierten Request gesetzt.
--
-- --------------------------------------------------------------------------
-- 3. S01-17: `whistleblowing_audit_log` — Lese-Policy ohne Mandantenprädikat
-- --------------------------------------------------------------------------
-- Die Policy `wb_audit_log_officer_read` prüft ausschliesslich
-- `app.current_user_role IN ('whistleblowing_officer','ombudsperson','admin')`
-- — OHNE org_id-Bedingung. Sobald irgendein Codepfad diesen GUC setzt (was
-- 0284:465 als vorgesehene Mechanik ausweist), liest jeder Admin jedes
-- Mandanten das Hinweisgeber-Audit-Log ALLER Mandanten: nach HinSchG
-- besonders schutzbedürftige Daten (Identität hinweisgebender Personen,
-- Untersuchungsschritte). Dass der GUC heute nirgends gesetzt wird, ist ein
-- Zufall der Implementierung, keine Kontrolle.
--
-- Die zweite Policy (`wb_audit_log_no_direct_write`, USING false) hilft
-- nicht: alle Policies sind PERMISSIVE und werden per OR verknüpft.
--
-- Fix: das Mandantenprädikat wird per AND ergänzt. Die Rollenprüfung bleibt
-- unverändert erhalten (sie ist zusätzlich, nicht ersetzt), FORCE kommt aus
-- Abschnitt 1.
--
-- Präzisierung gegenüber dem Auditbericht: dessen Tabellenmatrix führt
-- `whistleblowing_audit_log` mit `org_id = ja`. Gegen die migrationsgebaute
-- Datenbank nach WP1 gemessen hat die Tabelle KEINE `org_id` — die
-- Mandantenbindung läuft über `case_id` (NOT NULL) auf `wb_case`, das
-- `org_id` trägt und RLS+FORCE hat. Das Prädikat wird deshalb als EXISTS auf
-- `wb_case` formuliert. An der Bewertung des Befundes ändert das nichts: die
-- Policy hatte kein Mandantenprädikat, jetzt hat sie eines.

DO $gaps$
DECLARE
  t        RECORD;
  v_org    CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid';
  v_uid    CONSTANT text :=
    '(NULLIF(current_setting(''app.current_user_id'', true), ''''))::uuid';
  v_forced int := 0;
  v_left   int;
BEGIN
  ----------------------------------------------------------------------------
  -- 2. notification_preference — zuerst, damit Abschnitt 1 das FORCE setzt.
  ----------------------------------------------------------------------------
  IF to_regclass('public.notification_preference') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name = 'notification_preference'
                    AND column_name = 'user_id')
  THEN
    EXECUTE 'DROP POLICY IF EXISTS notification_preference_self ON public.notification_preference';
    EXECUTE format(
      'CREATE POLICY notification_preference_self ON public.notification_preference
         FOR ALL USING (user_id = %s)', v_uid);
    EXECUTE 'ALTER TABLE public.notification_preference ENABLE ROW LEVEL SECURITY';
  END IF;

  ----------------------------------------------------------------------------
  -- 3. whistleblowing_audit_log — Mandantenprädikat ergänzen.
  ----------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public'
                AND tablename = 'whistleblowing_audit_log'
                AND policyname = 'wb_audit_log_officer_read')
     AND to_regclass('public.wb_case') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name = 'whistleblowing_audit_log'
                    AND column_name = 'case_id')
  THEN
    -- Idempotent: nur ergänzen, wenn das Prädikat noch nicht drin ist.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'whistleblowing_audit_log'
         AND policyname = 'wb_audit_log_officer_read'
         AND qual LIKE '%wb_case%')
    THEN
    EXECUTE format(
      'ALTER POLICY wb_audit_log_officer_read ON public.whistleblowing_audit_log
         USING (EXISTS (SELECT 1 FROM public.wb_case wc
                         WHERE wc.id = public.whistleblowing_audit_log.case_id
                           AND wc.org_id = %s)
                AND (%s))',
      v_org,
      (SELECT qual FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'whistleblowing_audit_log'
          AND policyname = 'wb_audit_log_officer_read'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'whistleblowing_audit_log'
         AND policyname = 'wb_audit_log_officer_read'
         AND qual LIKE '%wb_case%')
    THEN
      RAISE EXCEPTION 'S01-17: Mandantenprädikat konnte nicht in wb_audit_log_officer_read eingefügt werden';
    END IF;
  ELSE
    RAISE EXCEPTION 'S01-17: wb_audit_log_officer_read / wb_case / case_id nicht wie erwartet vorgefunden';
  END IF;

  ----------------------------------------------------------------------------
  -- 1. FORCE ROW LEVEL SECURITY überall dort, wo RLS aktiv ist.
  ----------------------------------------------------------------------------
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity
       AND NOT c.relforcerowsecurity
     ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.relname);
    v_forced := v_forced + 1;
  END LOOP;

  SELECT count(*) INTO v_left
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND c.relrowsecurity AND NOT c.relforcerowsecurity;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'S01-20: % Tabellen mit RLS ohne FORCE verblieben', v_left;
  END IF;

  RAISE NOTICE 'S01-19/-20: % Tabellen auf FORCE gesetzt, notification_preference und wb_audit_log versorgt',
    v_forced;
END
$gaps$;
