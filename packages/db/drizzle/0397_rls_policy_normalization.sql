-- Migration 0397: einheitliche org_id-Policy-Form + selbsterhaltende RLS-Invarianten
--
-- Migration: 0397_rls_policy_normalization
-- Breaking: no
-- Estimated-Duration: 60
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-18, S01-25, S01-15]
--
-- Teil 1 (unten) normalisiert den Bestand. Teil 2 hält die Invarianten
-- danach von selbst aufrecht — siehe den Abschnitt "Warum ein Event-Trigger"
-- vor Teil 2.
--
-- Befund S01-18 (Medium): die org_id-Policies liegen in vier verschiedenen
-- Formen vor. Gemessen gegen die migrationsgebaute DB nach WP1:
--
--   445 Tabellen  mit mindestens einer Policy, die
--                 `current_setting('app.current_org_id', …)` OHNE NULLIF-Guard
--                 nach ::uuid castet  ->  ''::uuid THROWS
--   210 Tabellen  davon zusätzlich mit einargumentigem `current_setting(...)`
--                 (kein `missing_ok`)  ->  `unrecognized configuration
--                 parameter`, wenn der GUC nie gesetzt wurde
--    52 Policies  vergleichen `(org_id)::text = current_setting(...)` (S01-25)
--
-- Da alle Policies PERMISSIVE sind und per OR ausgewertet werden, genügt EINE
-- ungeschützte Policy, damit die gesamte Abfrage fehlschlägt. Nachweis
-- (evidence/S01_failmode_probe.txt):
--     SET app.current_org_id = '';
--     SELECT count(*) FROM risk;  --> ERROR: invalid input syntax for type uuid: ""
--
-- Um diesen Defekt herum ist die gesamte Zwei-Pool-Konstruktion in
-- `packages/db/src/index.ts` und `request-context.ts` gebaut (Basis-Pool nie
-- mit gesetztem GUC, Request-Pool nie kontextlos, "poison connection"-Regel).
-- Diese Migration beseitigt den Defekt an der Wurzel: jede org_id-Policy
-- bekommt die Form, die 442 andere bereits richtig haben:
--
--     org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid
--
-- Danach ist der Ausdruck bei jedem GUC-Zustand definiert: nicht gesetzt ->
-- NULL, leer -> NULL, gesetzt -> UUID. `org_id = NULL` ist NULL, also kein
-- Treffer — die Fehlrichtung bleibt fail-closed, aber ohne Exception. Der
-- Zwei-Pool-Aufbau bleibt bestehen (er hat weitere Gründe: exklusive
-- Verbindung je Request, PII-Scrubbing), er ist nur nicht mehr die einzige
-- Absicherung gegen einen 500er.
--
-- S01-25: der rein textuelle Vergleich `(org_id)::text = current_setting(...)`
-- wird auf denselben UUID-typisierten Vergleich gebracht. Fachlich äquivalent
-- (uuid::text ist immer kanonisch klein und mit Bindestrichen), aber
-- einheitlich und damit automatisiert prüfbar.
--
-- Verfahren: rein textuell über `pg_policies.qual/with_check` in der
-- Darstellung, die `pg_get_expr()` erzeugt, dann `ALTER POLICY`. Die bereits
-- korrekte NULLIF-Form wird vorher durch einen Platzhalter ersetzt, damit sie
-- nicht doppelt gewrappt wird. Nach dem Lauf prüft die Migration den
-- Endzustand und BRICHT AB, wenn noch eine ungeschützte Form übrig ist.
--
-- Andere GUCs (`app.current_user_id`, `app.current_user_role`) werden NICHT
-- angefasst: `app.current_user_id` wird von den betroffenen Policies bereits
-- durchweg mit NULLIF gelesen (0380), `app.current_user_role` wird als text
-- verglichen und castet nirgends.

DO $normalize$
DECLARE
  pol        RECORD;
  v_qual     text;
  v_check    text;
  v_touched  int := 0;
  v_left     int;
  -- Zielform
  c_good   CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id''::text, true), ''''::text))::uuid';
  -- Platzhalter, der in keinem Ausdruck vorkommen kann
  c_token  CONSTANT text := '@@ARCTOS_ORG_UUID@@';
BEGIN
  FOR pol IN
    SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') LIKE '%app.current_org_id%'
         OR coalesce(with_check, '') LIKE '%app.current_org_id%')
     ORDER BY tablename, policyname
  LOOP
    v_qual  := pol.qual;
    v_check := pol.with_check;

    -- 1. bereits korrekte Form aus dem Weg räumen
    v_qual  := replace(coalesce(v_qual, ''),  c_good, c_token);
    v_check := replace(coalesce(v_check, ''), c_good, c_token);

    -- 2. S01-25: textueller Vergleich -> UUID-Vergleich.
    v_qual := replace(v_qual,
      '(org_id)::text = current_setting(''app.current_org_id''::text, true)',
      'org_id = ' || c_token);
    v_check := replace(v_check,
      '(org_id)::text = current_setting(''app.current_org_id''::text, true)',
      'org_id = ' || c_token);

    -- 3. ungeschützte Casts (mit und ohne missing_ok) -> Zielform.
    v_qual := replace(v_qual,
      '(current_setting(''app.current_org_id''::text, true))::uuid', c_token);
    v_qual := replace(v_qual,
      '(current_setting(''app.current_org_id''::text))::uuid', c_token);
    v_check := replace(v_check,
      '(current_setting(''app.current_org_id''::text, true))::uuid', c_token);
    v_check := replace(v_check,
      '(current_setting(''app.current_org_id''::text))::uuid', c_token);

    -- 4. Platzhalter zurück in die Zielform.
    v_qual  := replace(v_qual,  c_token, c_good);
    v_check := replace(v_check, c_token, c_good);

    IF pol.qual IS NULL THEN v_qual := NULL; END IF;
    IF pol.with_check IS NULL THEN v_check := NULL; END IF;

    CONTINUE WHEN coalesce(v_qual, '') IS NOT DISTINCT FROM coalesce(pol.qual, '')
              AND coalesce(v_check, '') IS NOT DISTINCT FROM coalesce(pol.with_check, '');

    IF v_qual IS NOT NULL AND v_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                     pol.policyname, pol.tablename, v_qual, v_check);
    ELSIF v_qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
                     pol.policyname, pol.tablename, v_qual);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',
                     pol.policyname, pol.tablename, v_check);
    END IF;
    v_touched := v_touched + 1;
  END LOOP;

  -- Endzustand prüfen: keine Policy darf app.current_org_id mehr ohne
  -- NULLIF-Guard nach uuid casten oder textuell vergleichen.
  SELECT count(*) INTO v_left
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (coalesce(qual, '') || ' ' || coalesce(with_check, '') LIKE
            '%(current_setting(''app.current_org_id''::text))::uuid%'
       OR coalesce(qual, '') || ' ' || coalesce(with_check, '') LIKE
            '%(current_setting(''app.current_org_id''::text, true))::uuid%'
       OR coalesce(qual, '') || ' ' || coalesce(with_check, '') LIKE
            '%(org_id)::text = current_setting(''app.current_org_id''%');

  IF v_left > 0 THEN
    RAISE EXCEPTION 'S01-18/-25: % Policies tragen weiterhin eine ungeschützte org_id-Form', v_left;
  END IF;

  RAISE NOTICE 'S01-18/-25: % Policies auf die NULLIF-geschützte UUID-Form normalisiert', v_touched;
END
$normalize$;

-- ===========================================================================
-- Teil 2 — Warum ein Event-Trigger
-- ===========================================================================
-- Teil 1 repariert den Bestand zum Zeitpunkt dieser Migration. Das reicht
-- nicht, aus zwei gemessenen Gründen:
--
--  (a) Vier Migrationen laufen bei einem Neuaufbau grundsätzlich in einem
--      ZWEITEN Durchgang, also NACH allen anderen (`0068`, `0069`, `0071`,
--      `0106`; siehe WP1, Restrisiko 4). `0068`/`0069`/`0106` legen dabei
--      Views neu an — ohne `security_invoker`, womit der Fix aus `0393`
--      wieder verloren wäre. `0071` legt Policies ohne NULLIF-Guard an.
--      Gemessen: nach einem vollständigen Neuaufbau meldete das
--      Coverage-Gate genau diese sechs Objekte wieder als Lücke.
--
--  (b) Die Remediation läuft in mehreren parallelen Paketen mit eigenen
--      Nummernkreisen (0400+). Jede dieser Migrationen kann eine neue
--      mandantenbezogene Tabelle anlegen. Gemessen: `audit_chain_verification`
--      aus `0404` trug `org_id`, aber keine RLS.
--
-- Eine Migration kann nicht "am Ende" stehen. Ein Event-Trigger schon: er
-- greift bei JEDEM künftigen `CREATE TABLE`, `CREATE POLICY`, `CREATE VIEW`
-- und `CREATE MATERIALIZED VIEW` in `public` — unabhängig davon, welche
-- Migration, welches Paket und welcher Durchgang ihn auslöst.
--
-- Was er tut (und bewusst NICHT tut):
--   CREATE TABLE   mit `org_id` und ohne jede Policy -> ENABLE + FORCE RLS
--                  und eine org-skalierte FOR-ALL-Policy. Das ist die
--                  ADR-001-Zusage, jetzt erzwungen statt nachträglich per
--                  Gap-Closure-Migration nachgeholt. Eine Tabelle, die
--                  bereits eine eigene Policy mitbringt, wird NICHT angefasst
--                  — Pakete dürfen ihre eigene, engere Form wählen.
--   CREATE POLICY  -> Ausdruck auf die kanonische NULLIF-Form bringen und
--                  `app.bypass_rls` entfernen (S01-02/-18/-25).
--   CREATE VIEW    -> `security_invoker = true` (S01-08).
--   CREATE MATERIALIZED VIEW -> Leserecht für `grc_app` und PUBLIC entziehen.
--   CREATE FUNCTION mit SECURITY DEFINER -> `search_path` fixieren, EXECUTE
--                  von PUBLIC entziehen, `grc_app` gezielt gewähren (S01-13).
--
-- Sicherheitsnetz: Der Trigger fängt JEDE Ausnahme ab und meldet sie als
-- WARNING. Ein Event-Trigger, der wirft, blockiert sämtliche DDL der
-- Datenbank — ein Härtungsmechanismus darf niemals zum Totalausfall führen.
-- Was er nicht reparieren konnte, meldet danach
-- `node scripts/audit-rls-coverage.mjs --check` und der RLS-Systemtest.
--
-- Wiedereintritt ist über den GUC `arctos.rls_guard_active` unterbunden (die
-- vom Trigger selbst abgesetzten CREATE/ALTER POLICY lösen ihn sonst erneut
-- aus).
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.arctos_rls_normalize_policy(
  p_table text, p_policy text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  pol      record;
  v_qual   text;
  v_check  text;
  c_good   CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id''::text, true), ''''::text))::uuid';
  c_token  CONSTANT text := '@@ARCTOS_ORG_UUID@@';
  c_bypass CONSTANT text :=
    '(current_setting(''app.bypass_rls''::text, true) = ''true''::text)';
BEGIN
  SELECT * INTO pol FROM pg_policies
   WHERE schemaname = 'public' AND tablename = p_table AND policyname = p_policy;
  IF NOT FOUND THEN RETURN; END IF;

  v_qual  := coalesce(pol.qual, '');
  v_check := coalesce(pol.with_check, '');

  -- app.bypass_rls (S01-02)
  v_qual  := replace(replace(v_qual,  c_bypass || ' OR ', ''), ' OR ' || c_bypass, '');
  v_check := replace(replace(v_check, c_bypass || ' OR ', ''), ' OR ' || c_bypass, '');

  -- kanonische Form schützen
  v_qual  := replace(v_qual,  c_good, c_token);
  v_check := replace(v_check, c_good, c_token);
  -- Textvergleich (S01-25)
  v_qual  := replace(v_qual,
    '(org_id)::text = current_setting(''app.current_org_id''::text, true)',
    'org_id = ' || c_token);
  v_check := replace(v_check,
    '(org_id)::text = current_setting(''app.current_org_id''::text, true)',
    'org_id = ' || c_token);
  -- ungeschützte Casts (S01-18)
  v_qual  := replace(v_qual,
    '(current_setting(''app.current_org_id''::text, true))::uuid', c_token);
  v_qual  := replace(v_qual,
    '(current_setting(''app.current_org_id''::text))::uuid', c_token);
  v_check := replace(v_check,
    '(current_setting(''app.current_org_id''::text, true))::uuid', c_token);
  v_check := replace(v_check,
    '(current_setting(''app.current_org_id''::text))::uuid', c_token);

  v_qual  := replace(v_qual,  c_token, c_good);
  v_check := replace(v_check, c_token, c_good);

  IF pol.qual IS NULL THEN v_qual := NULL; END IF;
  IF pol.with_check IS NULL THEN v_check := NULL; END IF;

  IF coalesce(v_qual, '') IS NOT DISTINCT FROM coalesce(pol.qual, '')
     AND coalesce(v_check, '') IS NOT DISTINCT FROM coalesce(pol.with_check, '')
  THEN
    RETURN;
  END IF;

  IF v_qual IS NOT NULL AND v_check IS NOT NULL THEN
    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                   p_policy, p_table, v_qual, v_check);
  ELSIF v_qual IS NOT NULL THEN
    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
                   p_policy, p_table, v_qual);
  ELSE
    EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',
                   p_policy, p_table, v_check);
  END IF;
END
$fn$;

REVOKE ALL ON FUNCTION public.arctos_rls_normalize_policy(text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.arctos_rls_guard()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $guard$
DECLARE
  obj    record;
  pol    record;
  v_org  CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid';
  v_name text;
BEGIN
  IF coalesce(current_setting('arctos.rls_guard_active', true), '') = 'on' THEN
    RETURN;
  END IF;
  PERFORM set_config('arctos.rls_guard_active', 'on', true);

  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    -- ACHTUNG: für `policy`-Objekte liefert pg_event_trigger_ddl_commands()
    -- `schema_name = NULL` (die Policy ist kein schemaqualifiziertes Objekt;
    -- die Zugehörigkeit steckt in der Tabelle). Ein pauschales
    -- `schema_name = 'public'` filtert deshalb ausgerechnet CREATE POLICY
    -- weg — empirisch gegen PostgreSQL 16 nachgemessen. Die Schemaprüfung
    -- passiert darum je Zweig über den Katalog.
    BEGIN
      v_name := NULL;
      IF obj.command_tag = 'CREATE TABLE' THEN
        CONTINUE WHEN obj.schema_name IS DISTINCT FROM 'public';
        SELECT c.relname INTO v_name FROM pg_class c
         WHERE c.oid = obj.objid AND c.relkind = 'r';
        CONTINUE WHEN v_name IS NULL;
        CONTINUE WHEN v_name LIKE '\_%';           -- interne Hilfstabellen
        CONTINUE WHEN NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = v_name
             AND column_name = 'org_id');
        CONTINUE WHEN EXISTS (
          SELECT 1 FROM pg_policies
           WHERE schemaname = 'public' AND tablename = v_name);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_name);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_name);
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL USING (org_id = %s)',
          v_name || '_org_isolation', v_name, v_org);
        RAISE NOTICE '[arctos-rls-guard] RLS auf neuer Mandantentabelle % gesetzt', v_name;

      ELSIF obj.command_tag = 'CREATE VIEW' THEN
        CONTINUE WHEN obj.schema_name IS DISTINCT FROM 'public';
        SELECT c.relname INTO v_name FROM pg_class c
         WHERE c.oid = obj.objid AND c.relkind = 'v';
        CONTINUE WHEN v_name IS NULL;
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_name);

      ELSIF obj.command_tag = 'CREATE MATERIALIZED VIEW' THEN
        CONTINUE WHEN obj.schema_name IS DISTINCT FROM 'public';
        SELECT c.relname INTO v_name FROM pg_class c
         WHERE c.oid = obj.objid AND c.relkind = 'm';
        CONTINUE WHEN v_name IS NULL;
        EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', v_name);
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
          EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', v_name);
        END IF;

      ELSIF obj.command_tag = 'CREATE FUNCTION' THEN
        -- [S01-13] Jede später angelegte SECURITY-DEFINER-Funktion bekommt
        -- einen fixierten search_path und verliert EXECUTE an PUBLIC.
        -- `grc_app` bekommt es zurück, weil die Anwendung mehrere dieser
        -- Funktionen direkt aufruft (`record_migration_anchor`,
        -- `audit_anchor_verify`, `tombstone_audit_entry`) und ein Entzug sie
        -- brechen würde. Der Gewinn ist damit begrenzt, aber real: JEDE
        -- ANDERE Rolle — auch eine künftige Reporting- oder Worker-Rolle —
        -- kann sie nicht mehr aufrufen. Die eigentliche Kontrolle gegen
        -- mandantenübergreifenden Missbrauch ist die Org-Prüfung IM Rumpf
        -- (siehe 0398 für `tombstone_audit_entry`); sie gehört für die
        -- Audit-Trail-Funktionen zu WP4/WP8.
        DECLARE
          v_secdef  boolean;
          v_hascfg  boolean;
          v_ident   text;
        BEGIN
          SELECT p.prosecdef,
                 EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
                          WHERE c LIKE 'search_path=%'),
                 p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
            INTO v_secdef, v_hascfg, v_ident
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE p.oid = obj.objid AND n.nspname = 'public';
          IF v_secdef THEN
            v_name := v_ident;
            IF NOT v_hascfg THEN
              EXECUTE format('ALTER FUNCTION public.%s SET search_path = pg_catalog, public',
                             v_ident);
            END IF;
            EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', v_ident);
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
              EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO grc_app', v_ident);
            END IF;
          END IF;
        END;

      ELSIF obj.command_tag = 'CREATE POLICY' THEN
        SELECT c.relname AS tbl, p.polname AS pol INTO pol
          FROM pg_policy p
          JOIN pg_class c ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE p.oid = obj.objid AND n.nspname = 'public';
        CONTINUE WHEN pol.tbl IS NULL;
        PERFORM public.arctos_rls_normalize_policy(pol.tbl, pol.pol);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ein werfender Event-Trigger blockiert JEDE DDL der Datenbank.
      -- Deshalb nur warnen; das Coverage-Gate und der RLS-Systemtest melden
      -- anschliessend, was nicht repariert werden konnte.
      RAISE WARNING '[arctos-rls-guard] % auf % übersprungen: %',
        obj.command_tag, coalesce(v_name, '?'), SQLERRM;
    END;
  END LOOP;

  PERFORM set_config('arctos.rls_guard_active', 'off', true);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[arctos-rls-guard] deaktiviert für diese Anweisung: %', SQLERRM;
END
$guard$;

REVOKE ALL ON FUNCTION public.arctos_rls_guard() FROM PUBLIC;

DROP EVENT TRIGGER IF EXISTS arctos_rls_guard_trg;
CREATE EVENT TRIGGER arctos_rls_guard_trg
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE VIEW', 'CREATE MATERIALIZED VIEW',
               'CREATE POLICY', 'CREATE FUNCTION')
  EXECUTE FUNCTION public.arctos_rls_guard();

COMMENT ON FUNCTION public.arctos_rls_guard() IS
  'ARCTOS/WP2 S01-15: hält die RLS-Invarianten für JEDE später angelegte '
  'Tabelle, Policy und View aufrecht. Siehe Migration 0397, Teil 2.';
