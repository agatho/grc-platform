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

DO $cleanup$
DECLARE
  r record;
BEGIN
  -- 1. Alles, was der Seed namentlich erfasst hat (auch org-lose Kindzeilen).
  IF to_regclass('public._wp2_seed_ids') IS NOT NULL THEN
    FOR r IN SELECT tbl, id FROM _wp2_seed_ids WHERE id IS NOT NULL LOOP
      CONTINUE WHEN to_regclass('public.' || r.tbl) IS NULL;
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE id = %L', r.tbl, r.id);
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
      BEGIN
        EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', r.tbl);
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
DROP FUNCTION IF EXISTS _wp2_seed_value(text, text, text, "char", "char", oid, int, text);
DROP FUNCTION IF EXISTS _wp2_check_literal(text, text);

SET session_replication_role = 'origin';
