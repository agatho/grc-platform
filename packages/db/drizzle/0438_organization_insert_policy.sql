-- 0438_organization_insert_policy.sql
-- [ARCTOS-FULL-2026-08-31 / Restdefekte · O-2, konsistent zu WP2 (S01-*) und WP3 (S02-03)]
--
-- Befund O-2: `POST /api/v1/organizations` konnte unter der Laufzeitrolle
-- `grc_app` nicht funktionieren. `organization` trug nur
--
--     org_isolation_modify  FOR ALL  USING (id = <app.current_org_id>)
--
-- ohne eigenen WITH-CHECK-Ausdruck. PostgreSQL verwendet bei FOR ALL den
-- USING-Ausdruck auch als WITH CHECK. Eine NEUE Organisation kann diesen
-- Ausdruck per Definition nie erfüllen: ihre `id` wird erst beim INSERT
-- erzeugt und ist niemals die bereits aktive Org. Ergebnis: SQLSTATE 42501
-- bei jedem Mandanten-Anlegeversuch. Seit S01-10 (`APP_DATABASE_URL` in
-- Produktion verpflichtend) und WP2 (`assertRuntimeRoleIsolation()`) ist
-- damit die Mandantenanlage über die API in Produktion unmöglich.
--
-- ── Die Entscheidung: wer darf Organisationen anlegen? ───────────────
--
-- Sie fällt in zwei Fälle auseinander, und beide sind bereits an anderer
-- Stelle im Produkt entschieden; diese Migration schreibt sie nur endlich
-- in die Datenbank:
--
--  1) EIN NEUER MANDANT (Wurzelorganisation, `parent_org_id IS NULL`, oder
--     eine Zeile unter einer fremden Org) ist eine PLATTFORMWEITE Handlung.
--     `admin` ist laut WP3/S02-03 ausdrücklich eine PRO-ORGANISATION
--     vergebene Rolle und trägt plattformweite Wirkung nicht. Zuständig ist
--     der Plattform-Admin aus Migration 0411 (Tabelle `platform_admin`,
--     Prüffunktion `public.auth_is_platform_admin(uuid)` aus 0412).
--     Die Rolle ist bewusst über KEINEN API-Pfad vergebbar; damit lässt
--     sich dieser Zweig der Policy auch nicht über die Anwendung erschleichen.
--
--  2) EINE TOCHTER DER EIGENEN ORG (`parent_org_id = <app.current_org_id>`)
--     ist eine mandanteninterne Handlung. Die Konzernhierarchie ist ein
--     bestehendes Produktmerkmal (`organization.parent_org_id`,
--     `hierarchy_level`, der Elternwähler in
--     `app/(dashboard)/organizations/new`, `GET /admin/org-hierarchy`,
--     `app_current_org_scope()` aus WP2). Sie an den Betreiber zu binden
--     hiesse, das Merkmal für Mandanten abzuschaffen.
--
-- ── Warum Fall 2 die Mandantentrennung nicht schwächt ────────────────
--
-- WP2 stützt die Korrektheit von `app_current_org_scope()` (die rekursive
-- Nachfahrensicht) ausdrücklich darauf, dass ein Mandant „eine fremde Org
-- nicht zur eigenen Nachfahrin machen" kann, weil das ein UPDATE von
-- `parent_org_id` der FREMDEN Zeile verlangte — was `org_isolation_modify`
-- verbietet. Diese Invariante bleibt unverändert:
--
--   * Die neue Policy gilt ausschliesslich FOR INSERT. UPDATE und DELETE
--     laufen weiter allein über `org_isolation_modify` (`id = current_org`),
--     also nur auf der eigenen Zeile. Eine bestehende fremde Org kann
--     niemand umhängen.
--   * Ein Mandant kann per INSERT nur NEUE, leere Zeilen unter die EIGENE
--     Org hängen. Deren Daten sind seine eigenen; sein Scope wächst um
--     nichts, was ihm nicht ohnehin gehört.
--   * Der umgekehrte Weg — eine neue Org unter eine FREMDE Org hängen und
--     so den Scope des Fremden vergiften — ist ausgeschlossen, weil der
--     Vergleich gegen `app.current_org_id` und nicht gegen eine
--     Nachfahrenmenge geht.
--
-- Kein `USING` auf einer FOR-INSERT-Policy: INSERT kennt nur WITH CHECK.
-- `org_isolation_modify` bleibt unberührt; permissive Policies werden
-- ODER-verknüpft, die neue Policy erweitert also ausschliesslich INSERT.

DO $$
BEGIN
  -- Fail loud statt lautlos schwächer: ohne die Prüffunktion aus 0412 wäre
  -- der Plattform-Admin-Zweig nicht ausdrückbar und die Policy wäre eine
  -- reine Tochter-Policy — das soll niemand unbemerkt bekommen.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'auth_is_platform_admin'
  ) THEN
    RAISE EXCEPTION
      '0438: public.auth_is_platform_admin(uuid) fehlt — Migration 0412 muss vorher laufen.';
  END IF;
END $$;

DROP POLICY IF EXISTS organization_create ON organization;
CREATE POLICY organization_create ON organization
  FOR INSERT
  WITH CHECK (
    -- (1) Plattform-Admin: darf jeden Mandanten anlegen.
    public.auth_is_platform_admin(
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    -- (2) Mandanten-Admin: darf ausschliesslich eine Tochter der aktiven Org
    --     anlegen. `parent_org_id IS NOT NULL` ist redundant zum Vergleich,
    --     steht aber ausdrücklich da, damit die Absicht beim Lesen der Policy
    --     nicht von der NULL-Semantik abhängt.
    OR (
      parent_org_id IS NOT NULL
      AND parent_org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  );

COMMENT ON POLICY organization_create ON organization IS
  'O-2: INSERT auf der Mandanten-Wurzeltabelle. Plattform-Admin (0411/0412) '
  'darf jede Org anlegen; ein Mandanten-Admin nur eine Tochter der aktiven Org. '
  'org_isolation_modify bleibt fuer UPDATE/DELETE allein zustaendig.';

-- Selbstprüfung: die Policy muss existieren und darf keinen USING-Ausdruck
-- tragen (sonst wäre sie versehentlich als FOR ALL geschrieben worden und
-- würde die Lese-Isolation aufweichen).
DO $$
DECLARE
  v_cmd  "char";
  v_qual text;
BEGIN
  SELECT polcmd, pg_get_expr(polqual, polrelid)
    INTO v_cmd, v_qual
    FROM pg_policy
   WHERE polrelid = 'organization'::regclass AND polname = 'organization_create';

  IF v_cmd IS NULL THEN
    RAISE EXCEPTION '0438: Policy organization_create wurde nicht angelegt.';
  END IF;
  IF v_cmd <> 'a' THEN
    RAISE EXCEPTION '0438: organization_create ist nicht FOR INSERT (polcmd=%).', v_cmd;
  END IF;
  IF v_qual IS NOT NULL THEN
    RAISE EXCEPTION '0438: organization_create traegt einen USING-Ausdruck — das weicht die Lese-Isolation auf.';
  END IF;
  RAISE NOTICE 'O-2: INSERT-Policy organization_create gesetzt (Plattform-Admin ODER Tochter der aktiven Org).';
END $$;
