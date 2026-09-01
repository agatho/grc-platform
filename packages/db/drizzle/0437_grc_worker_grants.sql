-- 0437_grc_worker_grants.sql
-- [ARCTOS-FULL-2026-08-31 / WP9 · S01-09, mit S03-01/S03-12 (WP4) und S10-01 (WP5)]
--
-- Der Worker verbindet ab jetzt als `grc_worker` (BYPASSRLS, NOSUPERUSER)
-- statt als SUPERUSER `grc` — siehe docker-compose.production.yml und
-- apps/worker/src/lib/db-role-guard.ts.
--
-- Ein Superuser hat implizit ALLES. `grc_worker` nicht. Drei Rechte, die
-- bisher aus dem Superuser-Status folgten, müssen deshalb ausdrücklich
-- vergeben werden — sonst bricht der Rollenwechsel genau die Fixes, die
-- Welle 2 gebaut hat:
--
--  1) `SET LOCAL ROLE grc_app` in `continuous-audit-runner.ts`. WP5 hat die
--     Ausführung von Custom-SQL-Regeln (S10-01, Critical) auf die
--     unprivilegierte Rolle heruntergestuft. Ein Superuser darf jede Rolle
--     annehmen; `grc_worker` braucht dafür die MITGLIEDSCHAFT in grc_app.
--     Ohne sie schlägt jede Custom-SQL-Regel fehl. Das ist fail-closed und
--     damit nicht unsicher, aber es wäre ein stiller Funktionsausfall.
--     Die Richtung ist eine Ent-, keine Eskalation: grc_worker hat mit
--     BYPASSRLS ohnehin mehr Rechte als grc_app.
--
--  2) Die Audit-Tabellen. Migration 0407 (WP4) hat die Leserechte gezielt
--     an grc_app vergeben und `relacl` damit von NULL auf eine echte Liste
--     gesetzt — was für jede andere Nicht-Eigentümer-Rolle bedeutet: kein
--     Zugriff. `daily-audit-anchor` schreibt aber in `audit_anchor`,
--     `audit-chain-verify` in `audit_chain_verification`. Ohne diese Grants
--     laufen beide Jobs in 42501, und die Merkle-Verankerung des
--     Audit-Trails (ADR-011) fällt aus — dasselbe Loch, das S10-08
--     beschreibt, nur mit anderer Ursache.
--
--     `audit_log` bekommt bewusst NUR SELECT: der Trail wird ausschließlich
--     über SECURITY-DEFINER-Trigger und `write_audit_entry()` geschrieben,
--     und daran ändert der Worker nichts.
--
--  3) Sequenzen und Funktionen, die an diesen Schreibpfaden hängen.
--
-- Die Grants stehen hier und nicht nur in deploy/provision-grc-app.sh, weil
-- ein Recht, das nur in einem Shell-Skript existiert, in CI, im
-- DR-Restore und in einer frischen Installation nicht existiert — dieselbe
-- Begründung wie in 0407.

DO $wgrants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_worker') THEN
    RAISE NOTICE '0437: Rolle grc_worker existiert nicht — Worker-Grants uebersprungen. '
                 'Anlegen mit GRC_WORKER_PASSWORD=... bash deploy/provision-grc-app.sh <db>';
    RETURN;
  END IF;

  -- ── 1. Basisrechte im Schema (Spiegel der grc_app-Grants) ───────────
  EXECUTE 'GRANT USAGE ON SCHEMA public TO grc_worker';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_worker';
  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grc_worker';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE grc IN SCHEMA public
             GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grc_worker';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE grc IN SCHEMA public
             GRANT USAGE, SELECT ON SEQUENCES TO grc_worker';

  -- Gegenstueck zu 0399/provision-grc-app.sh: die Auth.js-Adapter-Tabellen
  -- (deny-all-RLS seit 0392) und Materialized Views bleiben auch dem
  -- Worker entzogen. Er braucht sie nicht, und BYPASSRLS wuerde die
  -- deny-all-Policy sonst gerade aushebeln.
  IF to_regclass('public.session') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.session FROM grc_worker';
  END IF;
  IF to_regclass('public.account') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.account FROM grc_worker';
  END IF;
  IF to_regclass('public.verification_token') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.verification_token FROM grc_worker';
  END IF;

  -- ── 2. Mitgliedschaft in grc_app fuer SET LOCAL ROLE (S10-01) ───────
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    EXECUTE 'GRANT grc_app TO grc_worker';
  END IF;

  -- ── 3. Audit-Tabellen (WP4 / 0407) ──────────────────────────────────
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    -- Nur lesen. Geschrieben wird ausschliesslich ueber SECURITY-DEFINER.
    EXECUTE 'GRANT SELECT ON audit_log TO grc_worker';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_log FROM grc_worker';
  END IF;
  IF to_regclass('public.audit_anchor') IS NOT NULL THEN
    -- daily-audit-anchor legt Anker an und aktualisiert sie (Retry).
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON audit_anchor TO grc_worker';
    EXECUTE 'REVOKE DELETE, TRUNCATE ON audit_anchor FROM grc_worker';
  END IF;
  IF to_regclass('public.audit_chain_verification') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT ON audit_chain_verification TO grc_worker';
  END IF;
  IF to_regclass('public.audit_log_write_attempt') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON audit_log_write_attempt TO grc_worker';
  END IF;
  IF to_regclass('public.audit_sensitive_column') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON audit_sensitive_column TO grc_worker';
  END IF;
  IF to_regclass('public.audit_anchor_seal') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT ON audit_anchor_seal TO grc_worker';
  END IF;
END $wgrants$;

-- ── 4. Funktionen und Sequenzen ────────────────────────────────────────
-- Getrennter Block: eine fehlende Funktion darf die Tabellen-Grants oben
-- nicht mitreissen.
DO $wfuncs$
DECLARE r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_worker') THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'audit_chain_check', 'audit_chain_verify',
         'audit_chain_verify_and_record', 'write_audit_entry',
         'wb_audit_chain_verify', 'audit_anchor_seal_record',
         'audit_anchor_seal_export', 'tombstone_audit_entry')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO grc_worker', r.sig);
  END LOOP;

  FOR r IN
    SELECT c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'S'
       AND c.relname LIKE 'audit_%'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO grc_worker', r.relname);
  END LOOP;
END $wfuncs$;
