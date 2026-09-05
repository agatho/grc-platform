-- Migration 0391: RLS für mandantenbezogene Kindtabellen ohne eigene org_id
--
-- Migration: 0391_rls_child_tables
-- Breaking: no
-- Estimated-Duration: 15
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-01, S01-03]
--
-- Befund S01-03 (High): 18 Kindtabellen tragen keine eigene `org_id` und
-- deshalb — nach der Logik von `rls-audit.ts` ("keine org_id => platform,
-- RLS nicht nötig") — auch keine RLS. Auf DB-Ebene sind sie damit für JEDE
-- Mandanten-Session vollständig les-, änder- und löschbar. Der Inhalt ist
-- nicht nebensächlich: Freigabeentscheidungen (SoD), Attestierungsantworten,
-- Lieferanten-Due-Diligence samt Nachweisen, der anonyme Hinweisgeber-
-- Postkasten, die Rechtematrix eigener Rollen, API-Key-Scopes.
--
-- Nachweis aus dem Audit (evidence/S01_child_table_probe.txt, Kontext Org A,
-- je 1 Zeile pro Org geseedet):
--   approval_decision 2 | bowtie_path 6 | review_decision 2 | ...
--   BEGIN; DELETE FROM approval_decision;  -> DELETE 2  (BEIDE Mandanten)
--
-- Befund S01-01 (Critical) ist derselbe Defekt, einmal end-to-end über HTTP
-- erreichbar: `GET/PUT /api/v1/erm/bowtie/[riskId]` filtert `bowtie_path`
-- allein über die aus dem Pfad übernommene `riskId`. Diese Migration ist die
-- DB-seitige Hälfte des Fixes (die Route-seitige Eltern-Org-Prüfung steckt in
-- apps/web/src/app/api/v1/erm/bowtie/[riskId]/route.ts) — bewusst BEIDE, weil
-- die Isolation dieser Tabellenklasse sonst weiterhin an 1:1-Codereview
-- hinge, und genau das ist mit S01-01 bereits einmal schiefgegangen.
--
-- Policy-Form: `FOR ALL USING (EXISTS (SELECT 1 FROM <eltern> WHERE
-- <eltern>.id = <kind>.<fk> AND <eltern>.org_id = <org-GUC>))`. Bei FOR ALL
-- verwendet PostgreSQL den USING-Ausdruck auch als WITH CHECK, damit gilt
-- dieselbe Bedingung für INSERT und UPDATE — ein Kindsatz kann also weder
-- gelesen noch unter einen fremden Elternsatz gehängt werden.
--
-- Enkeltabellen (`esg_materiality_vote`, `playbook_task_template`,
-- `questionnaire_question`) bekommen den zweistufigen EXISTS ausgeschrieben,
-- statt sich auf die RLS der Zwischentabelle zu verlassen. Das ist
-- redundant, aber es macht die Isolation unabhängig von der
-- Auswertungsreihenfolge verschachtelter Policies lesbar und prüfbar.
--
-- Alle 18 FK-Spalten sind NOT NULL (geprüft gegen information_schema), es
-- gibt also keine elternlosen Zeilen, die durch den EXISTS unsichtbar
-- würden.
--
-- Zusätzlich: die vier Kindtabellen, die `0315_rls_gap_closure_v4.sql` nach
-- dem WP1-Fix bereits mit einer EXISTS-Policy versorgt hat
-- (`approval_decision`, `attestation_response`, `connector_field_mapping`,
-- `review_decision`), bekommen hier FORCE ROW LEVEL SECURITY; ihre
-- Policy-Ausdrücke normalisiert Migration 0397 (NULLIF-Guard, S01-18).

DO $child_rls$
DECLARE
  r         RECORD;
  v_org     CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid';
  v_created int := 0;
BEGIN
  FOR r IN
    SELECT *
      FROM (VALUES
        -- kind                      fk-spalte              eltern                          eltern-pk
        ('api_key_scope',            'api_key_id',          'api_key',                      'id'),
        ('architecture_change_vote', 'change_request_id',   'architecture_change_request',  'id'),
        ('bc_exercise_inject_log',   'exercise_id',         'bc_exercise',                  'id'),
        ('bowtie_path',              'risk_id',             'risk',                         'id'),
        ('crisis_contact_node',      'tree_id',             'crisis_contact_tree',          'id'),
        ('custom_dashboard_widget',  'dashboard_id',        'custom_dashboard',             'id'),
        ('dd_evidence',              'session_id',          'dd_session',                   'id'),
        ('dd_response',              'session_id',          'dd_session',                   'id'),
        ('esg_materiality_topic',    'assessment_id',       'esg_materiality_assessment',   'id'),
        ('onboarding_step',          'session_id',          'onboarding_session',           'id'),
        ('playbook_phase',           'template_id',         'playbook_template',            'id'),
        ('questionnaire_section',    'template_id',         'questionnaire_template',       'id'),
        ('recovery_procedure_step',  'procedure_id',        'recovery_procedure',           'id'),
        ('role_permission',          'role_id',             'custom_role',                  'id'),
        ('wb_anonymous_mailbox',     'report_id',           'wb_report',                    'id')
      ) AS t(child, fk_col, parent, parent_pk)
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.child) IS NULL;
    CONTINUE WHEN to_regclass('public.' || r.parent) IS NULL;
    -- Spaltenexistenz prüfen (WP1-Lehre aus 0315: `ALTER TABLE IF EXISTS`
    -- guardet nur die Tabelle, nicht die Spalte).
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = r.child
         AND column_name = r.fk_col);
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = r.parent
         AND column_name = 'org_id');

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.child);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.child);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   r.child || '_parent_org_isolation', r.child);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (EXISTS (
         SELECT 1 FROM public.%I p
          WHERE p.%I = public.%I.%I
            AND p.org_id = %s))',
      r.child || '_parent_org_isolation', r.child,
      r.parent, r.parent_pk, r.child, r.fk_col, v_org);
    v_created := v_created + 1;
  END LOOP;

  -- Enkeltabellen: zweistufiger EXISTS.
  FOR r IN
    SELECT *
      FROM (VALUES
        -- enkel                    fk-spalte     eltern                  eltern-fk        grosseltern
        ('esg_materiality_vote',    'topic_id',   'esg_materiality_topic', 'assessment_id', 'esg_materiality_assessment'),
        ('playbook_task_template',  'phase_id',   'playbook_phase',        'template_id',   'playbook_template'),
        ('questionnaire_question',  'section_id', 'questionnaire_section', 'template_id',   'questionnaire_template')
      ) AS t(child, fk_col, parent, parent_fk, grandparent)
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.child) IS NULL;
    CONTINUE WHEN to_regclass('public.' || r.parent) IS NULL;
    CONTINUE WHEN to_regclass('public.' || r.grandparent) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = r.child
         AND column_name = r.fk_col);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.child);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.child);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   r.child || '_parent_org_isolation', r.child);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (EXISTS (
         SELECT 1 FROM public.%I p
           JOIN public.%I g ON g.id = p.%I
          WHERE p.id = public.%I.%I
            AND g.org_id = %s))',
      r.child || '_parent_org_isolation', r.child,
      r.parent, r.grandparent, r.parent_fk, r.child, r.fk_col, v_org);
    v_created := v_created + 1;
  END LOOP;

  -- FORCE für die vier Kindtabellen, die 0315 bereits mit einer
  -- EXISTS-Policy versorgt hat, aber ohne FORCE angelegt hat.
  FOR r IN
    SELECT unnest(ARRAY['approval_decision', 'attestation_response',
                        'connector_field_mapping', 'review_decision']) AS child
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.child) IS NULL;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.child);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.child);
  END LOOP;

  RAISE NOTICE 'S01-03: RLS auf % Kindtabellen ohne org_id gesetzt', v_created;
END
$child_rls$;
