-- Migration 0392: RLS für die Auth-Kerntabellen user/session/account/verification_token
--
-- Migration: 0392_rls_auth_core_tables
-- Breaking: no
-- Estimated-Duration: 10
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-04]
--
-- Befund S01-04 (High): `user`, `session`, `account`, `verification_token`
-- tragen weder RLS noch eine einzige Policy. `user` führt `password_hash`
-- und `ical_token` (Bearer-artiges Kalender-Token), `session` führt
-- `session_token`, `account` führt `refresh_token`/`access_token`/`id_token`.
-- Für die Runtime-Rolle `grc_app` ist damit das globale Nutzerverzeichnis
-- ALLER Mandanten sichtbar (Nachweis evidence/S01_user_table_probe.txt).
--
-- --------------------------------------------------------------------------
-- 1. session / account / verification_token — Deny-all
-- --------------------------------------------------------------------------
-- Diese drei Tabellen sind Auth.js-Adapter-Tabellen. Das Projekt fährt die
-- JWT-Strategie und hat KEINEN DrizzleAdapter konfiguriert; die Volltextsuche
-- über apps/** und packages/** findet keinen einzigen Import von `account`,
-- `session` oder `verificationToken` aus `@grc/db` und keine SQL-Referenz auf
-- die Tabellennamen ausserhalb der Schema-Definition. Sie sind also leer und
-- unbenutzt, tragen aber die sensibelsten Spalten des Schemas.
--
-- Konsequenz: RLS + FORCE OHNE jede Policy. Unter `grc_app` (nicht Eigentümer)
-- ist das ein vollständiges Verbot — jede Leseabfrage liefert 0 Zeilen, jeder
-- Schreibvorgang scheitert. Migrationen, Seeds und der Worker laufen als
-- Superuser `grc` und sind davon nicht betroffen. Sollte Auth.js je auf den
-- DB-Adapter umgestellt werden, MUSS diese Migration durch echte, an
-- `app.current_user_id` gebundene Policies ersetzt werden — der Adapter
-- schlägt sonst sofort und laut fehl, nicht still.
--
-- --------------------------------------------------------------------------
-- 2. user — Mitgliedschafts- bzw. Selbst-Sichtbarkeit
-- --------------------------------------------------------------------------
-- `user` ist echt mandantenübergreifend (ein Nutzer kann mehreren Orgs
-- angehören), die Zugehörigkeit steht in `user_organization_role`. Die Policy
-- bildet genau das ab:
--
--   sichtbar, wenn  (a) es die eigene Zeile ist  (app.current_user_id), ODER
--                   (b) der Nutzer der aktuellen Org angehört, ODER
--                   (c) die Verbindung KEINEN Kontext trägt.
--
-- Zu (c) — die bewusste Grenze dieses Fixes, ausdrücklich als Restrisiko
-- dokumentiert und NICHT als geschlossen behauptet:
-- Der Anmeldepfad muss `user` per E-Mail lesen, BEVOR eine Identität
-- feststeht (`packages/auth/src/providers.ts:197` credentials-`authorize`,
-- `:341` SSO-Provisionierung). Diese Abfragen laufen kontextlos über den
-- Basis-Pool. PostgreSQL bietet für benutzerdefinierte GUCs keinen
-- Rechteschutz (`GRANT SET ON PARAMETER` gilt nur für Systemparameter), ein
-- "nur der Login darf das"-Marker wäre also genau der Escape-Hatch, den
-- Migration 0390 gerade entfernt hat. Der saubere Weg — die Anmeldeabfrage
-- über eine SECURITY-DEFINER-Funktion zu führen — verlangt eine Änderung an
-- `packages/auth/**`, das WP3 gehört, und ist dorthin übergeben (S02-05).
--
-- Was der Fix damit KONKRET leistet: jede Abfrage aus einem etablierten
-- Request-Kontext — also der gesamte authentifizierte HTTP-Verkehr, der über
-- `withAuth`/`reserveRequestContext` läuft — sieht ausschliesslich Nutzer der
-- eigenen Org und sich selbst. Cross-Tenant-Lesen und -Schreiben auf `user`
-- ist aus einer Mandanten-Session heraus nicht mehr möglich; genau das prüft
-- `tests/rls/tenant-isolation-systemtest.test.ts`.
-- Was er NICHT leistet: kontextlose Codepfade (Login, SSO-Provisionierung,
-- Worker) bleiben ungefiltert. Die 115 nicht in `withErrorHandler`
-- eingepackten Routen (S01-21) fallen ebenfalls in diese Klasse.
--
-- DELETE bekommt bewusst KEINE kontextlose Disjunktion: es gibt keinen
-- produktiven kontextlosen Löschpfad (Retention/Art.-17-Löschung läuft im
-- Worker als Superuser), also ist Löschen strikt org-gebunden.
--
-- INSERT ist bewusst permissiv: eine neue `user`-Zeile ohne Mitgliedschaft
-- ist kein Mandantendatum — die Mandantenbindung entsteht erst durch
-- `user_organization_role`, und die Tabelle trägt eigene RLS.

DO $auth_rls$
DECLARE
  v_org  CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid';
  v_uid  CONSTANT text :=
    '(NULLIF(current_setting(''app.current_user_id'', true), ''''))::uuid';
  -- Kontextlos = weder Org- noch User-GUC gesetzt (Basis-Pool: der GUC ist
  -- NULL; Request-Pool im Ruhezustand: '' — NULLIF fängt beide Formen).
  v_noctx CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), '''') IS NULL'
    ' AND NULLIF(current_setting(''app.current_user_id'', true), '''') IS NULL)';
  v_member text;
  t        text;
BEGIN
  ----------------------------------------------------------------------------
  -- 1. Deny-all auf den Auth.js-Token-Tabellen
  ----------------------------------------------------------------------------
  FOREACH t IN ARRAY ARRAY['session', 'account', 'verification_token'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    -- Defensiv: falls eine frühere Migration hier je eine Policy angelegt
    -- hat, muss sie weg — sonst ist "deny-all" eine Behauptung.
    DECLARE p RECORD;
    BEGIN
      FOR p IN SELECT policyname FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
    END;
  END LOOP;

  ----------------------------------------------------------------------------
  -- 2. user
  ----------------------------------------------------------------------------
  IF to_regclass('public.user') IS NOT NULL THEN
    v_member := format(
      'EXISTS (SELECT 1 FROM public.user_organization_role r
                WHERE r.user_id = public.%I.id AND r.org_id = %s)',
      'user', v_org);

    EXECUTE 'ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public."user" FORCE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS user_tenant_select ON public."user"';
    EXECUTE format(
      'CREATE POLICY user_tenant_select ON public."user" FOR SELECT
         USING (public."user".id = %s OR %s OR %s)',
      v_uid, v_member, v_noctx);

    EXECUTE 'DROP POLICY IF EXISTS user_tenant_insert ON public."user"';
    EXECUTE 'CREATE POLICY user_tenant_insert ON public."user" FOR INSERT
               WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS user_tenant_update ON public."user"';
    EXECUTE format(
      'CREATE POLICY user_tenant_update ON public."user" FOR UPDATE
         USING (public."user".id = %s OR %s OR %s)
         WITH CHECK (public."user".id = %s OR %s OR %s)',
      v_uid, v_member, v_noctx, v_uid, v_member, v_noctx);

    EXECUTE 'DROP POLICY IF EXISTS user_tenant_delete ON public."user"';
    EXECUTE format(
      'CREATE POLICY user_tenant_delete ON public."user" FOR DELETE
         USING (%s)', v_member);
  END IF;

  RAISE NOTICE 'S01-04: RLS auf user/session/account/verification_token gesetzt';
END
$auth_rls$;
