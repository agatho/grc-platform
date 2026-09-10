-- 0477_rls_guard_permanent.sql
--
-- Migration: 0477_rls_guard_permanent
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-087] Dauerschutz der RLS-Invarianten statt
-- einer Meldung nach der Tat.
--
-- ── Befund ──────────────────────────────────────────────────────────
-- Migration 0397 legt den Waechter `arctos_rls_guard()` an und haengt ihn an
-- `ddl_command_end` mit
--
--     WHEN TAG IN ('CREATE TABLE', 'CREATE VIEW', 'CREATE MATERIALIZED VIEW',
--                  'CREATE POLICY', 'CREATE FUNCTION')
--
-- Der Waechter deckt damit genau die eine Richtung ab, in der etwas ENTSTEHT.
-- Die Gegenrichtung — etwas Vorhandenes wird ENTFERNT — hat er nicht:
--
--     ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;     -- kein Tag im Filter
--     ALTER TABLE <t> NO FORCE ROW LEVEL SECURITY;    -- kein Tag im Filter
--     DROP POLICY <p> ON <t>;                         -- kein Tag im Filter
--
-- Gemessen am 2026-09-03 gegen eine von Null migrierte Datenbank
-- (426 Migrationen, 614 Tabellen): 520 Tabellen tragen `org_id`, und ALLE 520
-- stehen auf `relrowsecurity = true`, `relforcerowsecurity = true` und
-- mindestens einer Policy. Die Invariante ist also heute vollstaendig erfuellt
-- — sie war nur nicht gehalten. Drei Anweisungen genuegten, um eine beliebige
-- der 520 Tabellen mandantenoffen zu machen, und das einzige, was danach
-- gesprochen haette, waeren das Coverage-Tor und der RLS-Systemtest gewesen:
-- eine Meldung im naechsten CI-Lauf, nicht ein Schutz im Moment der Aenderung.
--
-- ── Warum der Waechter das nicht einfach mitmachen kann ──────────────
-- Ein Event-Trigger laeuft NACH der Anweisung. Der naive Ausbau — `DROP POLICY`
-- abfangen und die Standard-Policy sofort neu anlegen — bricht die
-- verbreitetste Form, in der dieses Repository Policies pflegt:
--
--     DROP POLICY IF EXISTS "x_org_isolation" ON "x";
--     CREATE POLICY "x_org_isolation" ON "x" FOR ALL USING (...);
--
-- 114 solcher Paare in 56 Migrationsdateien. Nach dem DROP steht die Tabelle
-- kurz ohne Policy da; legt der Waechter dort `x_org_isolation` wieder an,
-- scheitert das folgende CREATE mit 42710 und die Migration bricht ab. Ein
-- Schutz, der die eigenen Migrationen zerlegt, wird beim ersten Mal wieder
-- ausgebaut.
--
-- ── Bauart: Pruefung am Transaktionsende, nicht am Anweisungsende ────
-- Deshalb zwei Stufen.
--
--   1. Zwei zusaetzliche Event-Trigger MERKEN sich nur, welche Tabelle gerade
--      in einen ungeschuetzten Zustand geraten ist (`ALTER TABLE` ueber
--      `ddl_command_end`, `DROP POLICY` ueber `sql_drop`). Sie reparieren
--      nichts und werfen nichts.
--
--   2. Ein CONSTRAINT TRIGGER `DEFERRABLE INITIALLY DEFERRED` auf der
--      Merkliste feuert beim COMMIT — also nachdem die Transaktion ALLE ihre
--      Anweisungen abgesetzt hat. Erst dort wird der wirkliche Endzustand
--      gelesen. Hat die Transaktion die Policy inzwischen neu angelegt, ist
--      nichts zu tun; ist die Tabelle am Ende tatsaechlich offen, wird sie
--      geschlossen: ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY und,
--      falls keine Policy mehr da ist, `<tabelle>_org_isolation` mit genau dem
--      Praedikat, das 0397 als Normalform durchsetzt.
--
-- Das ist der Unterschied zwischen „nach der Tat melden" und „Dauerschutz":
-- die Transaktion, die eine Mandantentabelle oeffnen wollte, committet mit
-- geschlossener Tabelle. Der Reparaturweg ist DDL innerhalb eines
-- aufgeschobenen Triggers; dass PostgreSQL das zulaesst, ist gegen 16
-- nachgemessen und nicht angenommen.
--
-- ── Beweislast bleibt liegen ────────────────────────────────────────
-- Die Merkliste `arctos_rls_guard_event` wird NICHT geleert. Jede Zeile ist
-- der Nachweis, dass jemand eine Mandantentabelle geoeffnet hat, wer es war
-- (`by_role`), wann, mit welcher Anweisung und was der Waechter daraufhin
-- getan hat (`outcome`). Ohne diese Zeilen waere die Reparatur selbst
-- unsichtbar — und ein Schutz, den niemand sehen kann, ist von einem
-- fehlenden Schutz nicht zu unterscheiden.
--
-- ── Bewusste Ausnahmen ──────────────────────────────────────────────
-- 0379 nimmt fuenf Log-Tabellen absichtlich aus der RLS heraus (org-lose
-- INSERTs im Login-Pfad). Diese Migration laeuft danach, also ist 0379 beim
-- Lauf von Null nicht betroffen. Fuer kuenftige, ebenso bewusste Ausnahmen
-- gibt es einen benannten Weg statt eines stillen Umgehens:
--
--     SET LOCAL arctos.rls_guard_allow_unprotected = 'tabelle_a,tabelle_b';
--
-- Der Waechter protokolliert die Ausnahme trotzdem (`outcome = 'exempted'`).
--
-- ── ENABLE ALWAYS ───────────────────────────────────────────────────
-- Alle drei Trigger — die beiden neuen Event-Trigger und der Constraint-
-- Trigger — stehen auf ENABLE ALWAYS. `SET session_replication_role =
-- 'replica'` ist im Betrieb dieses Repositories ein gebrauchtes Mittel
-- (Datenbereinigung an append-only-Tabellen vorbei); ein Waechter, den diese
-- eine Zeile abschaltet, schuetzt genau dann nicht, wenn jemand ohnehin schon
-- an den Sicherungen vorbeiarbeitet. Der Waechter aus 0397 stand auf der
-- Voreinstellung (`ENABLE`, also nur `origin`) und wird hier mitgezogen.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER/EVENT TRIGGER IF EXISTS vor jedem CREATE.

-- ── 1. Merkliste ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arctos_rls_guard_event (
  id          bigserial PRIMARY KEY,
  table_name  text        NOT NULL,
  command_tag text        NOT NULL,
  by_role     text        NOT NULL DEFAULT current_user,
  noted_at    timestamptz NOT NULL DEFAULT now(),
  -- 'pending'  — gemerkt, Transaktionsende noch nicht erreicht
  -- 'settled'  — beim COMMIT war der Zustand wieder in Ordnung
  -- 'repaired' — der Waechter hat RLS/FORCE/Policy wiederhergestellt
  -- 'exempted' — durch arctos.rls_guard_allow_unprotected freigestellt
  -- 'vanished' — Tabelle existierte beim COMMIT nicht mehr
  outcome     text        NOT NULL DEFAULT 'pending',
  detail      text
);

COMMENT ON TABLE public.arctos_rls_guard_event IS
  'ARCTOS/OP-087: Jede Anweisung, die eine Mandantentabelle ungeschuetzt '
  'zurueckliess, samt dem, was der Waechter daraufhin getan hat. Wird nicht '
  'geleert — siehe Migration 0477.';

CREATE INDEX IF NOT EXISTS arctos_rls_guard_event_noted_at_idx
  ON public.arctos_rls_guard_event (noted_at DESC);

-- Rechte: NICHT der Voreinstellung ueberlassen — und nicht bei einem REVOKE
-- belassen.
--
-- 0399 und 0437 setzen `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO
-- grc_app, grc_worker`; gemessen am 2026-09-03 bekam diese Tabelle daraus
-- ungefragt `grc_app=arwd/grc, grc_worker=arwd/grc`. Das waere zweimal
-- falsch: die Anwendungsrolle koennte die Beweiszeilen loeschen, und sie
-- koennte durch einen INSERT den aufgeschobenen SECURITY-DEFINER-Trigger fuer
-- eine beliebige Tabelle ausloesen. Der Waechter repariert zwar nur (er
-- schwaecht nie), aber ein Wachdienst, den der Bewachte anrufen kann, ist
-- keiner.
--
-- Ein REVOKE allein haelt das NICHT. Gemessen: nach einem Lauf der
-- RLS-Testsuite stand `grc_app=arwd` wieder auf der Tabelle. Zehn Dateien
-- unter packages/db/tests/rls und apps/web/src/__tests__/rls-route-chain,
-- dazu `scripts/setup.sh` und `deploy/provision-grc-app.sh`, setzen
-- `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO
-- grc_app` — pauschal, ueber jede Tabelle, die es gerade gibt. Jede
-- tabellenweise Rechteentscheidung dieses Schemas wird davon ueberschrieben.
--
-- Haltbar ist deshalb nur RLS: `GRANT ON ALL TABLES` beruehrt sie nicht. Die
-- Tabelle bekommt RLS und genau eine Policy, die nichts erlaubt. Der
-- Eigentuemer (`grc`) umgeht RLS, weil hier bewusst KEIN FORCE gesetzt ist —
-- und die drei Waechterfunktionen laufen als SECURITY DEFINER, also unter
-- ihm. Fuer `grc_app` und `grc_worker` ist die Tabelle damit leer und
-- unbeschreibbar, egal welches GRANT das naechste Skript vergibt.
REVOKE ALL ON public.arctos_rls_guard_event FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.arctos_rls_guard_event_id_seq FROM PUBLIC;
DO $acl$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['grc_app', 'grc_worker'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.arctos_rls_guard_event FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE public.arctos_rls_guard_event_id_seq FROM %I', r);
    END IF;
  END LOOP;
END
$acl$;

ALTER TABLE public.arctos_rls_guard_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arctos_rls_guard_event_deny ON public.arctos_rls_guard_event;
CREATE POLICY arctos_rls_guard_event_deny
  ON public.arctos_rls_guard_event
  FOR ALL
  USING (false)
  WITH CHECK (false);
COMMENT ON POLICY arctos_rls_guard_event_deny ON public.arctos_rls_guard_event IS
  'ARCTOS/OP-087: verweigert jeder Rolle ausser dem Eigentuemer den Zugriff. '
  'Bewusst ohne FORCE — die Waechterfunktionen laufen als SECURITY DEFINER '
  'unter dem Eigentuemer und muessen schreiben koennen.';

-- ── 2. Ist eine Tabelle eine ungeschuetzte Mandantentabelle? ─────────
-- Eine Stelle, an der die Invariante steht. Wird von beiden Event-Triggern
-- (zum Merken) und vom Constraint-Trigger (zum Reparieren) gelesen, damit
-- „was gilt als offen" nicht an drei Orten leicht verschieden definiert ist.
CREATE OR REPLACE FUNCTION public.arctos_rls_unprotected(p_table text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  r record;
BEGIN
  SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity,
         (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS npol
    INTO r
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = p_table;

  IF NOT FOUND THEN
    RETURN NULL;                               -- keine Tabelle (mehr)
  END IF;

  -- Interne Hilfstabellen und alles ohne Mandantenspalte gehen den Waechter
  -- nichts an — dieselbe Abgrenzung wie in 0397.
  IF p_table LIKE '\_%' THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = p_table
       AND column_name = 'org_id')
  THEN
    RETURN NULL;
  END IF;

  IF NOT r.relrowsecurity THEN
    RETURN 'rls_disabled';
  ELSIF r.npol = 0 THEN
    RETURN 'no_policy';
  ELSIF NOT r.relforcerowsecurity THEN
    RETURN 'not_forced';
  END IF;

  RETURN NULL;                                 -- geschuetzt
END
$fn$;

REVOKE ALL ON FUNCTION public.arctos_rls_unprotected(text) FROM PUBLIC;

-- ── 3. Der aufgeschobene Teil: Pruefung und Reparatur beim COMMIT ────
CREATE OR REPLACE FUNCTION public.arctos_rls_guard_settle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_state  text;
  v_org    CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid';
  v_exempt text;
  v_done   text[] := '{}';
BEGIN
  -- Rekursionsschutz: die Reparatur selbst ist DDL und wuerde die beiden
  -- Merk-Trigger erneut ausloesen.
  IF coalesce(current_setting('arctos.rls_guard_active', true), '') = 'on' THEN
    RETURN NULL;
  END IF;

  v_state := public.arctos_rls_unprotected(NEW.table_name);

  IF v_state IS NULL THEN
    -- Entweder wieder in Ordnung (die Transaktion hat die Policy neu
    -- angelegt) oder die Tabelle ist weg / war nie eine Mandantentabelle.
    UPDATE public.arctos_rls_guard_event
       SET outcome = CASE
             WHEN to_regclass('public.' || quote_ident(NEW.table_name)) IS NULL
               THEN 'vanished' ELSE 'settled' END
     WHERE id = NEW.id;
    RETURN NULL;
  END IF;

  v_exempt := coalesce(current_setting('arctos.rls_guard_allow_unprotected', true), '');
  IF NEW.table_name = ANY (string_to_array(v_exempt, ',')) THEN
    UPDATE public.arctos_rls_guard_event
       SET outcome = 'exempted', detail = v_state
     WHERE id = NEW.id;
    RAISE WARNING '[arctos-rls-guard] % bleibt ungeschuetzt (%): durch arctos.rls_guard_allow_unprotected freigestellt',
      NEW.table_name, v_state;
    RETURN NULL;
  END IF;

  PERFORM set_config('arctos.rls_guard_active', 'on', true);

  BEGIN
    IF v_state = 'rls_disabled' THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', NEW.table_name);
      v_done := array_append(v_done, 'ENABLE ROW LEVEL SECURITY');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = NEW.table_name)
    THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (org_id = %s)',
        NEW.table_name || '_org_isolation', NEW.table_name, v_org);
      v_done := array_append(v_done, 'CREATE POLICY ' || NEW.table_name || '_org_isolation');
    END IF;

    IF NOT (SELECT c.relforcerowsecurity FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = NEW.table_name)
    THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', NEW.table_name);
      v_done := array_append(v_done, 'FORCE ROW LEVEL SECURITY');
    END IF;

    UPDATE public.arctos_rls_guard_event
       SET outcome = 'repaired',
           detail  = v_state || ' -> ' || array_to_string(v_done, '; ')
     WHERE id = NEW.id;

    RAISE WARNING '[arctos-rls-guard] % war % — wiederhergestellt: %',
      NEW.table_name, v_state, array_to_string(v_done, '; ');
  EXCEPTION WHEN OTHERS THEN
    -- Anders als der Waechter aus 0397 darf dieser Zweig NICHT stillschweigend
    -- weiterlaufen: hier ist bereits erwiesen, dass eine Mandantentabelle beim
    -- COMMIT offen steht. Gelingt die Reparatur nicht, ist Abbrechen die
    -- einzige Antwort, die den Zustand nicht falsch darstellt.
    PERFORM set_config('arctos.rls_guard_active', 'off', true);
    RAISE EXCEPTION
      '[arctos-rls-guard] % steht ungeschuetzt (%) und liess sich nicht schliessen: %',
      NEW.table_name, v_state, SQLERRM;
  END;

  PERFORM set_config('arctos.rls_guard_active', 'off', true);
  RETURN NULL;
END
$fn$;

REVOKE ALL ON FUNCTION public.arctos_rls_guard_settle() FROM PUBLIC;

DROP TRIGGER IF EXISTS arctos_rls_guard_settle_trg ON public.arctos_rls_guard_event;
CREATE CONSTRAINT TRIGGER arctos_rls_guard_settle_trg
  AFTER INSERT ON public.arctos_rls_guard_event
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.arctos_rls_guard_settle();

ALTER TABLE public.arctos_rls_guard_event
  ENABLE ALWAYS TRIGGER arctos_rls_guard_settle_trg;

-- ── 4. Merken: ALTER TABLE ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arctos_rls_guard_on_alter()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  obj    record;
  v_name text;
BEGIN
  IF coalesce(current_setting('arctos.rls_guard_active', true), '') = 'on' THEN
    RETURN;
  END IF;

  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    CONTINUE WHEN obj.schema_name IS DISTINCT FROM 'public';
    SELECT c.relname INTO v_name FROM pg_class c
     WHERE c.oid = obj.objid AND c.relkind = 'r';
    CONTINUE WHEN v_name IS NULL;
    CONTINUE WHEN public.arctos_rls_unprotected(v_name) IS NULL;

    INSERT INTO public.arctos_rls_guard_event (table_name, command_tag, detail)
    VALUES (v_name, obj.command_tag, public.arctos_rls_unprotected(v_name));
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Merken darf keine DDL blockieren; die Pruefung selbst haengt am
  -- Constraint-Trigger und der wirft, wenn es darauf ankommt.
  RAISE WARNING '[arctos-rls-guard] Vormerkung nach ALTER TABLE fehlgeschlagen: %', SQLERRM;
END
$fn$;

REVOKE ALL ON FUNCTION public.arctos_rls_guard_on_alter() FROM PUBLIC;

DROP EVENT TRIGGER IF EXISTS arctos_rls_guard_alter_trg;
CREATE EVENT TRIGGER arctos_rls_guard_alter_trg
  ON ddl_command_end
  WHEN TAG IN ('ALTER TABLE')
  EXECUTE FUNCTION public.arctos_rls_guard_on_alter();
ALTER EVENT TRIGGER arctos_rls_guard_alter_trg ENABLE ALWAYS;

-- ── 5. Merken: DROP POLICY ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arctos_rls_guard_on_drop_policy()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  obj    record;
  v_name text;
BEGIN
  IF coalesce(current_setting('arctos.rls_guard_active', true), '') = 'on' THEN
    RETURN;
  END IF;

  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects() LOOP
    CONTINUE WHEN obj.object_type IS DISTINCT FROM 'policy';
    -- `original` trennt „diese Policy war das Ziel" von „sie fiel mit ihrer
    -- Tabelle" — gemessen an PostgreSQL 16: DROP TABLE meldet die Policies
    -- derselben Tabelle mit original = false.
    CONTINUE WHEN NOT obj.original;
    -- address_names = {schema, tabelle, policy}
    CONTINUE WHEN obj.address_names[1] IS DISTINCT FROM 'public';
    v_name := obj.address_names[2];
    CONTINUE WHEN v_name IS NULL;
    CONTINUE WHEN public.arctos_rls_unprotected(v_name) IS NULL;

    INSERT INTO public.arctos_rls_guard_event (table_name, command_tag, detail)
    VALUES (v_name, 'DROP POLICY', public.arctos_rls_unprotected(v_name));
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[arctos-rls-guard] Vormerkung nach DROP POLICY fehlgeschlagen: %', SQLERRM;
END
$fn$;

REVOKE ALL ON FUNCTION public.arctos_rls_guard_on_drop_policy() FROM PUBLIC;

DROP EVENT TRIGGER IF EXISTS arctos_rls_guard_drop_policy_trg;
CREATE EVENT TRIGGER arctos_rls_guard_drop_policy_trg
  ON sql_drop
  WHEN TAG IN ('DROP POLICY')
  EXECUTE FUNCTION public.arctos_rls_guard_on_drop_policy();
ALTER EVENT TRIGGER arctos_rls_guard_drop_policy_trg ENABLE ALWAYS;

-- ── 6. Der Waechter aus 0397 wird mitgezogen ────────────────────────
ALTER EVENT TRIGGER arctos_rls_guard_trg ENABLE ALWAYS;

-- Der Waechter aus 0397 vergibt bei JEDEM `CREATE FUNCTION` mit
-- SECURITY DEFINER automatisch `GRANT EXECUTE … TO grc_app` (0397, Zweig
-- 'CREATE FUNCTION'). Fuer die drei Funktionen dieser Migration ist das
-- unnoetig: zwei davon sind Trigger-Funktionen, die PostgreSQL ohnehin nur
-- als Trigger aufruft, und die dritte ist eine reine Katalogabfrage. Entzogen,
-- damit die Rechteliste die Absicht zeigt und nicht die Voreinstellung.
DO $acl2$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    REVOKE ALL ON FUNCTION public.arctos_rls_guard_settle() FROM grc_app;
    REVOKE ALL ON FUNCTION public.arctos_rls_guard_on_alter() FROM grc_app;
    REVOKE ALL ON FUNCTION public.arctos_rls_guard_on_drop_policy() FROM grc_app;
    REVOKE ALL ON FUNCTION public.arctos_rls_unprotected(text) FROM grc_app;
  END IF;
END
$acl2$;

COMMENT ON FUNCTION public.arctos_rls_guard_settle() IS
  'ARCTOS/OP-087: prueft beim COMMIT, ob eine gemerkte Mandantentabelle noch '
  'ungeschuetzt ist, und schliesst sie. Siehe Migration 0477.';
