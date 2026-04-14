-- Migration 0089: Security Fixes
-- Fixes: Missing RLS, missing audit triggers

-- ============================================================
-- 1. CRITICAL: Missing RLS on eu_taxonomy_assessment
-- ============================================================

ALTER TABLE eu_taxonomy_assessment ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY rls_eu_taxonomy ON eu_taxonomy_assessment USING (org_id = current_setting('app.current_org_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Also fix other tables from migration 0079 that may be missing RLS
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'root_cause_analysis', 'audit_sampling', 'exception_report',
    'approval_workflow', 'approval_request'
  ]) LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('CREATE POLICY rls_%s ON %I USING (org_id = current_setting(''app.current_org_id'')::uuid)', replace(tbl, '.', '_'), tbl);
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 2. HIGH: Audit triggers on all new tables
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'ai_system', 'ai_gpai_model', 'ai_incident', 'ai_prohibited_screening',
    'ai_provider_qms', 'ai_corrective_action', 'ai_authority_communication',
    'ai_penalty', 'ai_conformity_assessment', 'ai_human_oversight_log',
    'ai_transparency_entry', 'ai_fria', 'ai_framework_mapping',
    'isms_nonconformity', 'isms_corrective_action',
    'risk_acceptance', 'risk_acceptance_authority',
    'eu_taxonomy_assessment'
  ]) LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger()',
        replace(tbl, '.', '_'), tbl
      );
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN duplicate_object THEN NULL;
      WHEN undefined_function THEN
        RAISE NOTICE 'audit_trigger() function not found — skipping trigger for %', tbl;
    END;
  END LOOP;
END $$;
