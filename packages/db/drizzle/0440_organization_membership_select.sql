-- 0440_organization_membership_select.sql
-- [ARCTOS-FULL-2026-08-31 / E2E-Triage-2 · C-04]
--
-- Migration: 0440_organization_membership_select
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- Befund C-04 (erste Triage, bewusst offen gelassen; hier entschieden):
-- `organization` trug als einzige SELECT-Policy
--
--     org_isolation_select  USING (bypass OR id = <app.current_org_id>)
--
-- Ueber die org-gepinnte Verbindung kann damit JEDE Auflistung hoechstens
-- EINE Zeile zurueckgeben — die gerade aktive Organisation. Gemessen an der
-- laufenden Instanz (Sitzung admin@arctos.local, aktive Org ccc4cc1c…):
--
--   GET /api/v1/organizations?limit=100 -> genau 1 Eintrag
--   GET /api/v1/organizations/tree      -> genau 1 Knoten, children: []
--
-- obwohl das Konto Mitgliedschaften in NEUN Organisationen hat. Fachliche
-- Folge: der Organisationswechsler kann prinzipiell nicht funktionieren (er
-- listet die Orgs, in die gewechselt werden koennte — und bekommt immer nur
-- die, in der man schon ist), und eine frisch angelegte Tochter ist ihrem
-- Ersteller unsichtbar, obwohl POST /organizations ihm im selben Commit die
-- `admin`-Rolle darauf gibt.
--
-- ── Die Entscheidung: Mitgliedschaft, nicht gelockerte Isolation ─────
--
-- Der naheliegende, falsche Weg waere, `org_isolation_select` aufzuweichen
-- (z. B. auf "alle Orgs" oder auf einen Bypass-GUC). Das wuerde die
-- Mandantentrennung an ihrer Wurzel loesen. Zustaendig ist stattdessen die
-- Mitgliedschaft: `user_organization_role` IST im Produkt bereits die
-- Autorisierungsquelle fuer genau diese Frage —
--
--   * `getAccessibleOrgIds(session)` (packages/auth/src/rbac.ts:125) leitet
--     die zugreifbaren Orgs aus den Rollen des Nutzers ab;
--   * `POST /api/v1/auth/switch-org` erlaubt den Wechsel ausschliesslich in
--     eine Org aus dieser Menge;
--   * `POST /api/v1/organizations` vergibt dem Ersteller im selben
--     Transaktionsrahmen eine `admin`-Rolle auf der neuen Org, ausdruecklich
--     damit sie „in seiner Liste, im Switcher und in Folgeabfragen
--     erscheint".
--
-- Die Datenbank kannte diese Regel bisher nicht. Diese Migration schreibt
-- sie dort hin, wo sie hingehoert — als zusaetzliche, eng gefasste
-- SELECT-Policy auf genau EINER Tabelle.
--
-- ── Warum das die Isolation nicht aufweicht ──────────────────────────
--
--  1) Die Policy gilt NUR `FOR SELECT` und NUR auf `organization`.
--     `org_isolation_modify` (FOR ALL, `id = <app.current_org_id>`) bleibt
--     unveraendert und ist weiterhin die einzige Policy, die UPDATE und
--     DELETE erlaubt — auf der eigenen Zeile. Niemand kann eine fremde Org
--     aendern, umhaengen oder loeschen. Die Invariante, auf die sich WP2 bei
--     `app_current_org_scope()` stuetzt („ein Mandant kann eine fremde Org
--     nicht zur eigenen Nachfahrin machen"), haengt genau daran und bleibt.
--  2) Sichtbar wird ausschliesslich die STAMMDATENZEILE einer Organisation,
--     in der der Aufrufer selbst eine Rolle hat. Kein Datensatz irgendeiner
--     anderen Tabelle wird dadurch lesbar: jede Fachtabelle traegt ihre
--     eigene Policy auf `org_id = <app.current_org_id>`, und die aendert
--     sich hier nicht. Wer Daten einer anderen Org sehen will, muss weiter
--     dorthin WECHSELN — und das prueft `switch-org` gegen dieselbe
--     Mitgliedschaftsmenge.
--  3) Die Mitgliedschaft wird SERVERSEITIG aus `user_organization_role`
--     gelesen, nicht aus einem GUC, den der Aufrufer faerben koennte. Der
--     einzige Eingabewert ist `app.current_user_id`, den ausschliesslich
--     `reserveAndConfigure()` (packages/db/src/request-context.ts:169) aus
--     der serverseitig geprueften Sitzung setzt.
--  4) Ist `app.current_user_id` nicht gesetzt (Basispool, anonyme Pfade),
--     liefert die Funktion `false` — das Verhalten ist dann exakt das
--     bisherige.
--
-- Zweiter Arm: die eigene Org UND ihre Nachfahren (`app_current_org_scope()`
-- aus 0396). Das ist keine Erweiterung des Mandanten, sondern dieselbe
-- Nachfahrenmenge, die WP2/S01-06 fuer `audit_log`, `access_log` und
-- `audit_anchor` bereits als „eigene Daten" entschieden hat; ohne sie zeigt
-- `/organizations/tree` die Konzernhierarchie nicht an, die es darstellen
-- soll (der Anwendungsfilter dort listet ausdruecklich auch die direkten
-- Toechter der zugreifbaren Orgs).
--
-- SECURITY DEFINER ist noetig, weil `user_organization_role` seinerseits
-- unter `org_isolation` (`org_id = <app.current_org_id>`) steht: eine
-- Unterabfrage in der Policy saehe nur Rollen der AKTIVEN Org und koennte
-- die Frage „in welchen Orgs bin ich Mitglied?" gar nicht beantworten.
-- Gehaertet wie alle SECURITY-DEFINER-Funktionen aus 0412 (S01-13):
-- fixierter `search_path`, `REVOKE ... FROM PUBLIC`, gezielter GRANT.

CREATE OR REPLACE FUNCTION public.auth_user_is_org_member(
  p_user_id uuid,
  p_org_id  uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT p_user_id IS NOT NULL
     AND p_org_id  IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.user_organization_role r
        WHERE r.user_id = p_user_id
          AND r.org_id  = p_org_id
          AND r.deleted_at IS NULL
     );
$$;

COMMENT ON FUNCTION public.auth_user_is_org_member(uuid, uuid) IS
  'C-04: Hat der Nutzer eine nicht geloeschte Rolle in dieser Organisation? '
  'SECURITY DEFINER, weil user_organization_role selbst unter der '
  'org_id-Isolation steht und eine Policy-Unterabfrage nur Rollen der '
  'AKTIVEN Org saehe.';

REVOKE ALL ON FUNCTION public.auth_user_is_org_member(uuid, uuid) FROM PUBLIC;

DO $grant$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION public.auth_user_is_org_member(uuid, uuid) TO grc_app;
  END IF;
END $grant$;

-- Ohne den Scope-Helfer aus 0396 waere der zweite Arm nicht ausdrueckbar.
-- Fail loud statt stillschweigend nur den Mitgliedschafts-Arm zu setzen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'app_current_org_scope'
  ) THEN
    RAISE EXCEPTION
      '0440: public.app_current_org_scope() fehlt — Migration 0396 muss vorher laufen.';
  END IF;
END $$;

DROP POLICY IF EXISTS organization_membership_select ON organization;
CREATE POLICY organization_membership_select ON organization
  FOR SELECT
  USING (
    -- (1) Organisationen, in denen der Aufrufer selbst eine Rolle hat.
    --     Das ist die Menge, die der Org-Switcher anbietet und gegen die
    --     switch-org prueft.
    public.auth_user_is_org_member(
      NULLIF(current_setting('app.current_user_id', true), '')::uuid,
      id
    )
    -- (2) Die aktive Org und ihre Nachfahren (WP2/S01-06, Funktion aus 0396).
    OR id IN (SELECT public.app_current_org_scope())
  );

COMMENT ON POLICY organization_membership_select ON organization IS
  'C-04: Lesbar sind die Stammdatenzeilen der Organisationen, in denen der '
  'Nutzer Mitglied ist (user_organization_role), plus die aktive Org und ihre '
  'Nachfahren. Nur SELECT und nur auf dieser Tabelle — org_isolation_modify '
  'bleibt fuer UPDATE/DELETE allein zustaendig, jede Fachtabelle behaelt ihre '
  'eigene org_id-Isolation.';

-- Selbstpruefung: die Policy muss existieren, FOR SELECT sein und keinen
-- WITH-CHECK-Ausdruck tragen (ein WITH CHECK hier waere ein Schreibrecht).
DO $$
DECLARE
  v_cmd "char";
  v_wc  text;
BEGIN
  SELECT polcmd, pg_get_expr(polwithcheck, polrelid)
    INTO v_cmd, v_wc
    FROM pg_policy
   WHERE polrelid = 'organization'::regclass
     AND polname  = 'organization_membership_select';

  IF v_cmd IS NULL THEN
    RAISE EXCEPTION '0440: Policy organization_membership_select wurde nicht angelegt.';
  END IF;
  IF v_cmd <> 'r' THEN
    RAISE EXCEPTION '0440: organization_membership_select ist nicht FOR SELECT (polcmd=%).', v_cmd;
  END IF;
  IF v_wc IS NOT NULL THEN
    RAISE EXCEPTION '0440: organization_membership_select traegt einen WITH-CHECK-Ausdruck — das waere ein Schreibrecht.';
  END IF;

  -- org_isolation_modify muss unangetastet sein: sie ist die einzige Policy,
  -- die UPDATE/DELETE auf organization erlaubt.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid = 'organization'::regclass
       AND polname  = 'org_isolation_modify'
  ) THEN
    RAISE EXCEPTION '0440: org_isolation_modify fehlt — die Schreib-Isolation waere offen.';
  END IF;

  RAISE NOTICE 'C-04: SELECT-Policy organization_membership_select gesetzt (Mitgliedschaft ODER eigener Org-Scope).';
END $$;
