-- Migration 0393: Views auf security_invoker, Materialized Views entziehen
--
-- Migration: 0393_rls_views_security_invoker
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-08]
--
-- Befund S01-08 (High): PostgreSQL wertet eine View ohne
-- `security_invoker = true` mit den Rechten ihres EIGENTÜMERS aus. Eigentümer
-- aller Views im Schema ist `grc` (SUPERUSER, umgeht RLS bedingungslos). Eine
-- Abfrage der Runtime-Rolle `grc_app` gegen eine solche View liest damit an
-- der RLS der Basistabellen vorbei.
--
-- Nachweis aus dem Audit (evidence/S01_view_leak_probe.txt, Kontext Org A):
--   grc_budget direct          | foreign_rows 0 | total 1
--   v_budget_usage VIEW        | foreign_rows 1 | total 2
--   copilot_usage_stats MV     | foreign_rows 1 | total 2
--   evidence_review_summary MV | foreign_rows 1 | total 2
--
-- --------------------------------------------------------------------------
-- 1. Views: security_invoker
-- --------------------------------------------------------------------------
-- PostgreSQL 15+ kennt `ALTER VIEW ... SET (security_invoker = true)`. Danach
-- werden die Basistabellen mit den Rechten und dem RLS-Kontext des AUFRUFERS
-- gelesen — `v_budget_usage` liefert unter `grc_app` genau die Zeilen, die
-- eine direkte Abfrage von `grc_budget` auch liefern würde.
--
-- Die Migration setzt die Option katalog-getrieben auf JEDE View in `public`,
-- nicht nur auf die drei aus dem Befund. Grund: die Eigenschaft ist für eine
-- View ohne Mandantenbezug (Katalog-Views) folgenlos, aber sie macht die
-- Klasse insgesamt regressionsfest — eine künftige View erbt sie zwar nicht
-- automatisch, aber `scripts/audit-rls-coverage.mjs --check` und
-- `tests/rls/tenant-isolation-systemtest.test.ts` melden das dann.
--
-- --------------------------------------------------------------------------
-- 2. Materialized Views: Leserecht entziehen
-- --------------------------------------------------------------------------
-- Materialized Views kennen `security_invoker` NICHT und können keine RLS
-- tragen: ihr Inhalt entsteht beim REFRESH unter dem Eigentümer und ist damit
-- mandantenübergreifend materialisiert. Es gibt genau zwei
-- (`copilot_usage_stats`, `evidence_review_summary`); die Volltextsuche über
-- apps/** und packages/** findet für beide KEINE einzige Referenz im
-- Anwendungscode.
--
-- Entscheidung: statt sie zu löschen (das wäre eine Schemaänderung an
-- Objekten, die andere Pakete evtl. noch einplanen) wird `grc_app` und PUBLIC
-- das Leserecht entzogen. Damit ist der Pfad für die Runtime-Rolle hart
-- geschlossen (`permission denied for materialized view`), während der
-- Superuser-Refresh und eine spätere, org-gefilterte Nutzung möglich bleiben.
-- Wer sie wieder öffnen will, muss dafür eine bewusste Migration schreiben —
-- und dann eine org-Filterung mitliefern.
--
-- Hinweis für WP2/0399: `GRANT SELECT ON ALL TABLES IN SCHEMA public`
-- erfasst auch Materialized Views. 0399 wiederholt diesen REVOKE deshalb
-- NACH seinem GRANT; `deploy/provision-grc-app.sh` ebenso.

DO $views$
DECLARE
  v          RECORD;
  v_views    int := 0;
  v_matviews int := 0;
BEGIN
  FOR v IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'v'
     ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.relname);
    v_views := v_views + 1;
  END LOOP;

  FOR v IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'm'
     ORDER BY c.relname
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', v.relname);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', v.relname);
    END IF;
    v_matviews := v_matviews + 1;
  END LOOP;

  RAISE NOTICE 'S01-08: % Views auf security_invoker, % Materialized Views entzogen',
    v_views, v_matviews;
END
$views$;
