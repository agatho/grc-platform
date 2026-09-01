-- Migration 0394: `org_id IS NULL`-Policies entschärfen (globale Zeilen nur noch lesbar)
--
-- Migration: 0394_rls_global_row_policies
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-07]
--
-- Befund S01-07 (High): sieben Tabellen tragen eine FOR-ALL-Policy der Form
--
--     (org_id IS NULL) OR (org_id = <org-GUC>)
--
-- Bei `FOR ALL` verwendet PostgreSQL den USING-Ausdruck AUCH als WITH CHECK.
-- `org_id = NULL` ist damit nicht nur lesbar, sondern SCHREIBBAR: Mandant A
-- legt eine Zeile mit `org_id = NULL` an, Mandant B liest, ändert und löscht
-- sie. Praktisch nachgewiesen (evidence/S01_nullorg_probe.txt):
--
--   -- Kontext Org A
--   INSERT INTO regulatory_source (org_id, name, source_type, url, jurisdiction)
--   VALUES (NULL,'S01-GLOBAL-POISON','rss','http://evil.example/feed','EU');
--   -- Kontext Org B
--   UPDATE regulatory_source SET url='http://tenantB-tampered.example' ... -> UPDATE 1
--   DELETE FROM regulatory_source WHERE name='S01-GLOBAL-POISON';          -> DELETE 1
--
-- Die Wirkung ist tabellenabhängig und durchweg gravierend:
-- `regulatory_source` speist die vom Worker abgerufenen Feed-URLs (Poisoning-
-- /SSRF-Kette), `copilot_prompt_template` und `eam_ai_prompt_template`
-- speisen AI-Prompts (mandantenübergreifende Prompt-Injection),
-- `emission_factor` speist ESG-Kennzahlen, `automation_rule_template`
-- Automatisierungsregeln.
--
-- Fix: die eine FOR-ALL-Policy wird durch VIER kommandospezifische ersetzt.
-- Damit bleibt die fachlich gewollte Funktion erhalten (plattformweite
-- Vorlagen/Faktoren sind für alle Mandanten LESBAR), während der
-- Schreibkanal verschwindet:
--
--   SELECT : org_id IS NULL  OR  org_id = <org>     (Vorlagen bleiben sichtbar)
--   INSERT : org_id = <org>                          (kein NULL mehr schreibbar)
--   UPDATE : org_id = <org>  (USING und WITH CHECK)  (globale Zeile unantastbar,
--                                                     und keine eigene Zeile
--                                                     nach global "umhängbar")
--   DELETE : org_id = <org>
--
-- Wer plattformweite Vorlagen pflegen muss, tut das als Superuser über eine
-- Migration oder einen Seed — nicht über eine Mandanten-Session. Das ist
-- exakt die Trennung, die S02-03 (Plattform-Admin-Konzept, WP3) für die
-- org-losen Konfigurationstabellen ohnehin einführen soll.

DO $nullorg$
DECLARE
  pol     RECORD;
  v_org   CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid';
  v_count int := 0;
  v_left  int;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') LIKE '%org_id IS NULL%'
         OR coalesce(with_check, '') LIKE '%org_id IS NULL%')
     ORDER BY tablename, policyname
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT
         USING (org_id IS NULL OR org_id = %s)',
      pol.tablename || '_global_or_org_select', pol.tablename, v_org);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT
         WITH CHECK (org_id = %s)',
      pol.tablename || '_org_insert', pol.tablename, v_org);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE
         USING (org_id = %s) WITH CHECK (org_id = %s)',
      pol.tablename || '_org_update', pol.tablename, v_org, v_org);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE
         USING (org_id = %s)',
      pol.tablename || '_org_delete', pol.tablename, v_org);

    -- FORCE, damit die Trennung auch dann gilt, wenn der Tabelleneigentümer
    -- je auf eine Nicht-Superuser-Rolle umgestellt wird (S01-20).
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', pol.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', pol.tablename);
    v_count := v_count + 1;
  END LOOP;

  SELECT count(*) INTO v_left
    FROM pg_policies
   WHERE schemaname = 'public'
     AND coalesce(with_check, qual, '') LIKE '%org_id IS NULL%'
     AND cmd IN ('ALL', 'INSERT', 'UPDATE');

  IF v_left > 0 THEN
    RAISE EXCEPTION 'S01-07: % schreibende Policies erlauben org_id IS NULL weiterhin', v_left;
  END IF;

  RAISE NOTICE 'S01-07: % Tabellen von FOR-ALL auf kommandospezifische Policies umgestellt', v_count;
END
$nullorg$;
