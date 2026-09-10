-- ===========================================================================
-- [ARCTOS-FULL-2026-08-31 / WP2] Aufräumen nach dem RLS-Systemtest
-- ===========================================================================
-- Entfernt alles, was `tenant-isolation-seed.sql` angelegt hat. Läuft als
-- Superuser mit `session_replication_role = 'replica'`, damit die Reihenfolge
-- der Löschungen keine Rolle spielt (keine FK-Prüfung, keine Trigger).
--
-- Wird VOR dem Seed und in `afterAll` ausgeführt: vor dem Seed, damit ein
-- abgebrochener Vorlauf keine Zeilen hinterlässt, die den nächsten Seed an
-- UNIQUE-Constraints scheitern lassen.
-- ===========================================================================

SET session_replication_role = 'replica';
SET client_min_messages = warning;

-- [ARCTOS-FULL-2026-08-31 / WP11 · S11-11] Merker fuer den Trigger-Zustand,
-- damit `ENABLE ALWAYS` nach dem Aufraeumen `ENABLE ALWAYS` bleibt.
CREATE TABLE IF NOT EXISTS _wp2_trigger_state (
  tbl          text  NOT NULL,
  tgname       text  NOT NULL,
  prev_enabled "char" NOT NULL,
  PRIMARY KEY (tbl, tgname)
);
TRUNCATE _wp2_trigger_state;

DO $cleanup$
DECLARE
  r record;
BEGIN
  -- 1. Alles, was der Seed namentlich erfasst hat (auch org-lose Kindzeilen).
  IF to_regclass('public._wp2_seed_ids') IS NOT NULL THEN
    FOR r IN SELECT tbl, id FROM _wp2_seed_ids WHERE id IS NOT NULL LOOP
      CONTINUE WHEN to_regclass('public.' || r.tbl) IS NULL;
      BEGIN
        -- [OP-088] `id::text`: `_wp2_seed_ids.id` ist Text, damit auch
        -- bigint-Schluessel erfasst werden.
        EXECUTE format('DELETE FROM public.%I WHERE id::text = %L', r.tbl, r.id);
      EXCEPTION WHEN OTHERS THEN
        NULL;  -- Tabelle inzwischen weg / Spalte anders: nicht fatal
      END;
    END LOOP;
  END IF;

  -- 2. Alles, was noch an einer der beiden Test-Orgs hängt.
  --
  -- Zweistufig: erst der einfache DELETE. Schlägt er fehl, liegt das an einer
  -- Append-only-RULE oder einem `ENABLE ALWAYS`-Guard-Trigger — beides gibt es
  -- auf den Log-Tabellen, und `session_replication_role = 'replica'` schaltet
  -- `ENABLE ALWAYS`-Trigger und RULES ausdrücklich NICHT ab. Ohne den zweiten
  -- Anlauf blieben die Testzeilen liegen und der nächste Seed scheiterte am
  -- UNIQUE-Index (gemessen an `audit_anchor`).
  FOR r IN
    SELECT cl.relname AS tbl
      FROM pg_class cl
      JOIN pg_namespace n ON n.oid = cl.relnamespace
     WHERE cl.relkind = 'r' AND n.nspname = 'public'
       AND EXISTS (SELECT 1 FROM information_schema.columns col
                    WHERE col.table_schema = 'public'
                      AND col.table_name = cl.relname
                      AND col.column_name = 'org_id')
  LOOP
    BEGIN
      EXECUTE format(
        'DELETE FROM public.%I WHERE org_id IN
           (''aa000000-0000-4000-8000-000000000001''::uuid,
            ''bb000000-0000-4000-8000-000000000002''::uuid)', r.tbl);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        -- [WP11 · S11-11] Zustand JE TRIGGER merken, bevor er abgeschaltet
        -- wird — sonst laesst er sich nachher nicht originalgetreu
        -- wiederherstellen (s. der lange Kommentar weiter unten).
        INSERT INTO _wp2_trigger_state (tbl, tgname, prev_enabled)
        SELECT r.tbl, t.tgname, t.tgenabled
          FROM pg_trigger t
         WHERE t.tgrelid = ('public.' || quote_ident(r.tbl))::regclass
           AND NOT t.tgisinternal
        ON CONFLICT (tbl, tgname) DO NOTHING;

        EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', r.tbl);
        DECLARE rl record;
        BEGIN
          FOR rl IN SELECT rw.rulename FROM pg_rewrite rw
                     WHERE rw.ev_class = ('public.' || quote_ident(r.tbl))::regclass
                       AND rw.rulename <> '_RETURN' LOOP
            EXECUTE format('ALTER TABLE public.%I DISABLE RULE %I', r.tbl, rl.rulename);
          END LOOP;
        END;
        EXECUTE format(
          'DELETE FROM public.%I WHERE org_id IN
             (''aa000000-0000-4000-8000-000000000001''::uuid,
              ''bb000000-0000-4000-8000-000000000002''::uuid)', r.tbl);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[wp2-cleanup] % konnte nicht bereinigt werden: %', r.tbl, SQLERRM;
      END;
      -- Guards in jedem Fall wiederherstellen.
      --
      -- [ARCTOS-FULL-2026-08-31 / WP11 · S11-11] `ENABLE TRIGGER USER` war
      -- hier falsch und hat still Schaden angerichtet: es setzt tgenabled auf
      -- 'O' (origin) — auch fuer Trigger, die vorher 'A' (ENABLE ALWAYS)
      -- waren. Genau die Guards, die dieser Block wegen `ENABLE ALWAYS`
      -- vorher abschalten musste, kamen als origin-only zurueck und feuerten
      -- danach unter `session_replication_role = 'replica'` NICHT mehr.
      --
      -- Gemessen: nach einem RLS-Lauf standen
      -- `audit_anchor_append_only_trg`, `audit_anchor_no_truncate` und
      -- `wb_audit_log_append_only_trg` auf 'O'; die WP4-Abnahmetests
      -- "refuses to rewrite the Merkle root … replica role included" (S03-01)
      -- und S03-15 schlugen deshalb fehl — in einer anderen Suite, mit einer
      -- Fehlermeldung, die auf den Audit-Trail zeigte statt auf dieses
      -- Aufraeumskript. Ein Cleanup, das eine Sicherheitskontrolle dauerhaft
      -- entschaerft, ist schlimmer als ein Cleanup, das nicht aufraeumt.
      --
      -- Jetzt wird der Zustand JE TRIGGER zurueckgesetzt: 'A' bleibt 'A',
      -- 'O' bleibt 'O'. Der Zustand wird vor dem Abschalten gelesen — siehe
      -- die Tabelle `_wp2_trigger_state` weiter oben.
      BEGIN
        DECLARE tg record;
        BEGIN
          FOR tg IN
            SELECT t.tgname, s.prev_enabled
              FROM pg_trigger t
              JOIN _wp2_trigger_state s
                ON s.tbl = r.tbl AND s.tgname = t.tgname
             WHERE t.tgrelid = ('public.' || quote_ident(r.tbl))::regclass
               AND NOT t.tgisinternal
          LOOP
            EXECUTE format(
              'ALTER TABLE public.%I %s TRIGGER %I',
              r.tbl,
              CASE tg.prev_enabled
                WHEN 'A' THEN 'ENABLE ALWAYS'
                WHEN 'R' THEN 'ENABLE REPLICA'
                WHEN 'D' THEN 'DISABLE'
                ELSE 'ENABLE'
              END,
              tg.tgname);
          END LOOP;
        END;
        DECLARE rl record;
        BEGIN
          FOR rl IN SELECT rw.rulename FROM pg_rewrite rw
                     WHERE rw.ev_class = ('public.' || quote_ident(r.tbl))::regclass
                       AND rw.rulename <> '_RETURN' LOOP
            EXECUTE format('ALTER TABLE public.%I ENABLE RULE %I', r.tbl, rl.rulename);
          END LOOP;
        END;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[wp2-cleanup] Guards auf % nicht wiederhergestellt: %', r.tbl, SQLERRM;
      END;
    END;
  END LOOP;
END
$cleanup$;

DELETE FROM user_organization_role
 WHERE id IN ('aa000000-0000-4000-8000-0000000000a2'::uuid,
              'bb000000-0000-4000-8000-0000000000b2'::uuid);
DELETE FROM "user"
 WHERE id IN ('aa000000-0000-4000-8000-0000000000a1'::uuid,
              'bb000000-0000-4000-8000-0000000000b1'::uuid);
DELETE FROM organization
 WHERE id IN ('aa000000-0000-4000-8000-000000000001'::uuid,
              'bb000000-0000-4000-8000-000000000002'::uuid);

DROP TABLE IF EXISTS _wp2_seed_ids;
DROP TABLE IF EXISTS _wp2_seed_errors;
-- [WP11 · S11-11] Merker nicht liegen lassen — er ist reiner Testzustand.
DROP TABLE IF EXISTS _wp2_trigger_state;
DROP FUNCTION IF EXISTS _wp2_seed_value(text, text, text, "char", "char", oid, int, text);
DROP FUNCTION IF EXISTS _wp2_check_literal(text, text);
-- [ARCTOS-FULL-2026-08-31 · OP-088] Die drei Helfer, mit denen der Seed die
-- fuenf zuvor ungeprueften Tabellen erreicht.
DROP FUNCTION IF EXISTS _wp2_check_minlen(text, text);
DROP FUNCTION IF EXISTS _wp2_in_check(text, text);
DROP FUNCTION IF EXISTS _wp2_unique_nulls_not_distinct(text, text);

SET session_replication_role = 'origin';
