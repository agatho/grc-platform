-- Migration 0399: Grants für die Runtime-Rolle grc_app ins versionierte Schema
--
-- Migration: 0399_grc_app_grants
-- Breaking: no
-- Estimated-Duration: 20
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-12]
--
-- Befund S01-12 (Medium): die Grants für `grc_app` und
-- `ALTER TABLE organization FORCE ROW LEVEL SECURITY` (#SEC-F09) existieren
-- ausschliesslich in `deploy/provision-grc-app.sh`. In der vom Audit
-- vorgefundenen, vollständig migrierten Datenbank galt deshalb:
--
--     SELECT count(DISTINCT table_name) FROM information_schema.table_privileges
--      WHERE grantee='grc_app' AND privilege_type='SELECT';        -- 0
--     psql -U grc_app -c "select count(*) from risk;"
--     ERROR:  permission denied for table risk
--
-- Jede Umgebung, die nur die Migrationen fährt (CI-Test-DB, DR-Restore, neue
-- Region, lokale Entwicklung), hat damit entweder keine funktionsfähige
-- `grc_app`-Rolle — und fällt über den `??`-Fallback in `packages/db/src/
-- index.ts` auf den Superuser zurück (S01-10) — oder bekommt Rechte nur,
-- wenn ein Shell-Skript manuell und in der richtigen Reihenfolge läuft.
--
-- `ALTER DEFAULT PRIVILEGES FOR ROLE grc` half nicht: es wirkt nur für
-- Objekte, die anschliessend von genau dieser Rolle erzeugt werden.
--
-- Diese Migration holt beides ins Schema. Sie ist bewusst tolerant:
--   * existiert die Rolle `grc_app` nicht (viele Dev-/Test-Datenbanken), ist
--     sie ein No-Op — sie legt KEINE Rolle mit Passwort an, Rollen sind
--     clusterweit und Passwörter gehören nicht in eine Migrationsdatei.
--     `deploy/provision-grc-app.sh` bleibt der Ort für Rolle und Passwort.
--   * FORCE RLS auf `organization` setzt bereits 0395 katalog-getrieben; hier
--     nur noch als explizite, benannte Absicherung des #SEC-F09-Fixes.
--
-- Die drei Auth.js-Token-Tabellen (`session`, `account`, `verification_token`)
-- bekommen NACH dem pauschalen GRANT ein gezieltes REVOKE: sie tragen seit
-- 0392 deny-all-RLS, und ohne Tabellenrecht ist der Fehler eindeutig
-- ("permission denied") statt stiller Leere. Dasselbe für die beiden
-- Materialized Views aus 0393, die `GRANT ... ON ALL TABLES` sonst wieder
-- öffnen würde.
--
-- ALTER DEFAULT PRIVILEGES wird zusätzlich für JEDE Rolle gesetzt, die
-- aktuell Tabellen in `public` besitzt — nicht nur für `grc`. Damit erben auch
-- Objekte künftiger Migrationen die Grants, unabhängig davon, unter welchem
-- Rollennamen die Migration lief (das war die dritte Teilursache von S01-12).

DO $grants$
DECLARE
  o        RECORD;
  t        text;
  v_owners int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    RAISE NOTICE 'S01-12: Rolle grc_app existiert nicht — Grants übersprungen '
                 '(deploy/provision-grc-app.sh legt sie an).';
    RETURN;
  END IF;

  EXECUTE 'GRANT USAGE ON SCHEMA public TO grc_app';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app';
  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grc_app';

  -- Default-Privilegien für jede Rolle, die heute Tabellen in public besitzt.
  FOR o IN
    SELECT DISTINCT pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grc_app', o.owner);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
         GRANT USAGE, SELECT ON SEQUENCES TO grc_app', o.owner);
    v_owners := v_owners + 1;
  END LOOP;

  -- #SEC-F09, jetzt migrationsgestützt statt nur im Shell-Skript.
  IF to_regclass('public.organization') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.organization FORCE ROW LEVEL SECURITY';
  END IF;

  -- Auth.js-Token-Tabellen: deny-all auch auf Grant-Ebene (0392).
  FOREACH t IN ARRAY ARRAY['session', 'account', 'verification_token'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', t);
  END LOOP;

  -- Materialized Views: kein security_invoker möglich (0393).
  FOR o IN
    SELECT c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'm'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', o.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', o.relname);
  END LOOP;

  -- EXECUTE wird NICHT pauschal vergeben (0398 hat es gezielt entzogen);
  -- die eine von der Anwendung direkt aufgerufene SECURITY-DEFINER-Funktion
  -- ist dort explizit gegrantet. Nicht-SECURITY-DEFINER-Funktionen brauchen
  -- EXECUTE, das PUBLIC per Default ohnehin hat.

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
     WHERE grantee = 'grc_app' AND table_schema = 'public'
       AND privilege_type = 'SELECT' AND table_name = 'risk')
  THEN
    RAISE EXCEPTION 'S01-12: GRANT auf grc_app hat nicht gegriffen';
  END IF;

  RAISE NOTICE 'S01-12: Grants für grc_app gesetzt, Default-Privilegien für % Eigentümerrolle(n)',
    v_owners;
END
$grants$;
