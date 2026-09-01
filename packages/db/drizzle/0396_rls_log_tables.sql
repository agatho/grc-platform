-- Migration 0396: RLS für audit_log, access_log, audit_anchor — Ausnahme aufgehoben
--
-- Migration: 0396_rls_log_tables
-- Breaking: no
-- Estimated-Duration: 10
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-06, S01-26]
--
-- ==========================================================================
-- ENTSCHEIDUNG
-- ==========================================================================
-- Befund S01-06 (High): `0379_logtables_rls_exception.sql` schaltet RLS auf
-- `audit_log`, `access_log` und `audit_anchor` ausdrücklich AB und löscht alle
-- Policies. Der gesamte Audit-Trail aller Mandanten ist damit für die
-- Runtime-Rolle les- und (im Rahmen des Tombstone-Guards) schreibbar.
-- Praktisch nachgewiesen (Pflichttest des Audits, Rolle ohne BYPASSRLS,
-- Kontext = Org A):
--     access_log | SELECT | LEAK | foreign=1 own=1
--     audit_log  | SELECT | LEAK | foreign=1 own=1
--     audit_log  | UPDATE | LEAK | rows=1
--
-- Die Ausnahme hatte zwei genannte Begründungen. Beide sind geprüft:
--
--  (1) "org-loses INSERT beim Login": trifft zu. `access_log` wird beim
--      Anmeldeversuch geschrieben, BEVOR eine Org feststeht (`org_id` NULL),
--      und der Brute-Force-Check liest diese org-losen Zeilen kontextlos
--      zurück. Eine Policy der Form `org_id = <org-GUC>` würde beides
--      brechen. Das rechtfertigt aber — wie `0381` für `notification` und
--      `data_export_log` bereits vorführt — nur eine PERMISSIVE
--      INSERT-Policy, nicht das Abschalten der LESE-Isolation.
--
--  (2) "Lesen über die Org-Hierarchie" (`includeDescendants` im
--      audit-log-Endpunkt, ADR-011 rev.2): trägt NICHT. Befund S01-26 weist
--      nach, dass die rekursive CTE in `audit-log/route.ts:48-60` auf
--      `organization` läuft, deren Policy unter `grc_app` nur die eigene Org
--      sichtbar macht — `orgIdScope` enthält deshalb immer genau eine ID. Die
--      Ausnahme schützt also eine Funktion, die im abgesicherten Betrieb
--      ohnehin nicht funktioniert.
--
-- Entscheidung: **RLS wird aktiviert, und die Descendant-Logik wird anders
-- gelöst.** Die Alternative — Ausnahme behalten und kompensieren — wurde
-- verworfen: die Kompensation bestünde aus neun handgeschriebenen
-- `WHERE org_id = …`-Klauseln in neun Routen, von denen eine zu vergessen die
-- Offenlegung des Audit-Trails aller Kunden bedeutet. Für die zentrale
-- Compliance-Zusage des Produkts ist eine erzwungene DB-Kontrolle die
-- richtige Ebene. Die handgeschriebenen Filter bleiben zusätzlich bestehen
-- (Defense in Depth), sie werden durch diese Migration nicht überflüssig.
--
-- ==========================================================================
-- UMSETZUNG
-- ==========================================================================
-- a) `app_current_org_scope()` — SECURITY DEFINER, liefert die eigene Org
--    plus ihre Nachfahren aus `organization.parent_org_id`. SECURITY DEFINER
--    ist hier nötig und sicher: die Funktion umgeht die `organization`-RLS
--    (sonst käme sie nie über die eigene Zeile hinaus), gibt aber
--    ausschliesslich Orgs zurück, die per parent_org_id UNTER der eigenen
--    hängen. Ein Mandant kann sich keine fremde Org unterschieben: dazu
--    müsste er `organization.parent_org_id` der FREMDEN Zeile setzen, und
--    genau das verbietet die `org_isolation_modify`-Policy (`id = <eigene>`).
--    `search_path` ist fixiert, `EXECUTE` von PUBLIC entzogen (S01-13-Muster),
--    Rekursionstiefe begrenzt.
--
--    Damit ist die Descendant-Sicht auf DB-Ebene wieder möglich, ohne die
--    Isolation aufzugeben. Die Route `audit-log/route.ts` gehört WP4; sie
--    kann ihre rekursive CTE durch `SELECT * FROM app_current_org_scope()`
--    ersetzen und liefert dann tatsächlich, was ADR-011 rev.2 zusagt.
--    Übergeben in remediation/WP2.md.
--
-- b) Policies je Tabelle, nach dem `0381`-Muster (getrennt statt FOR ALL):
--    INSERT  : permissiv (`WITH CHECK true`) — die org-losen Login-Inserts
--              und die Trigger-Inserts müssen durchgehen.
--    SELECT  : `org_id IN (SELECT app_current_org_scope())`.
--              Bei `access_log` zusätzlich: org-lose Zeilen (`org_id IS NULL`,
--              also Login-Versuche ohne Mandantenbezug) sind sichtbar, wenn
--              die Verbindung KEINEN Org-Kontext trägt — das ist genau der
--              kontextlose Brute-Force-Check und kein Mandantendatum.
--              Eine Mandanten-Session sieht sie NICHT.
--    UPDATE  : strikt `org_id = <eigene Org>` (keine Nachfahren) — Tombstoning
--              ist eine Handlung an eigenen Daten.
--    DELETE  : strikt `org_id = <eigene Org>`; auf `audit_log`/`access_log`
--              greift zusätzlich weiterhin die Append-only-RULE.
--
-- c) FORCE ROW LEVEL SECURITY. Der `audit_trigger` läuft als SECURITY DEFINER
--    im Besitz des Superusers `grc` und ist davon unberührt (Superuser
--    umgehen RLS unabhängig von FORCE); die permissive INSERT-Policy deckt
--    ihn zusätzlich ab, falls die Eigentümerrolle je entprivilegiert wird.
--    WP4 ändert Trigger und Guards — diese Migration fasst sie nicht an.

-- ---------------------------------------------------------------------------
-- a) Org-Scope-Helfer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_current_org_scope()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH RECURSIVE scope AS (
    SELECT o.id, 1 AS depth
      FROM public.organization o
     WHERE o.id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid
    UNION
    SELECT o.id, s.depth + 1
      FROM public.organization o
      JOIN scope s ON o.parent_org_id = s.id
     WHERE s.depth < 32
  )
  SELECT id FROM scope;
$$;

REVOKE ALL ON FUNCTION public.app_current_org_scope() FROM PUBLIC;

DO $grant$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION public.app_current_org_scope() TO grc_app;
  END IF;
END $grant$;

COMMENT ON FUNCTION public.app_current_org_scope() IS
  'ARCTOS/WP2 S01-06+S01-26: eigene Org + Nachfahren aus organization.parent_org_id. '
  'SECURITY DEFINER, weil die organization-RLS sonst nur die eigene Zeile zeigt. '
  'Ersetzt die rekursive CTE in audit-log/route.ts (includeDescendants).';

-- ---------------------------------------------------------------------------
-- b/c) Policies + FORCE auf den drei Log-Tabellen
-- ---------------------------------------------------------------------------
DO $logs$
DECLARE
  t       text;
  p       RECORD;
  v_org   CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid';
  v_noctx CONSTANT text :=
    'NULLIF(current_setting(''app.current_org_id'', true), '''') IS NULL';
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_log', 'access_log', 'audit_anchor'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t AND column_name = 'org_id');

    -- Altbestand entfernen, damit keine Policy aus 0000/0315/0336 übrig
    -- bleibt, die 0379 nur zufällig nicht erwischt hat.
    FOR p IN SELECT policyname FROM pg_policies
              WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (true)',
      t || '_insert_open', t);

    IF t = 'access_log' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT
           USING (org_id IN (SELECT public.app_current_org_scope())
                  OR (org_id IS NULL AND %s))',
        t || '_org_select', t, v_noctx);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT
           USING (org_id IN (SELECT public.app_current_org_scope()))',
        t || '_org_select', t);
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE
         USING (org_id = %s) WITH CHECK (org_id = %s)',
      t || '_org_update', t, v_org, v_org);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (org_id = %s)',
      t || '_org_delete', t, v_org);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN ('audit_log', 'access_log', 'audit_anchor')
       AND NOT (c.relrowsecurity AND c.relforcerowsecurity))
  THEN
    RAISE EXCEPTION 'S01-06: RLS/FORCE auf den Log-Tabellen nicht vollständig gesetzt';
  END IF;

  RAISE NOTICE 'S01-06: RLS auf audit_log/access_log/audit_anchor aktiviert (0379-Ausnahme aufgehoben)';
END
$logs$;
