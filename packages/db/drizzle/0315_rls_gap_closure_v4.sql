-- Migration 0315: RLS gap-closure v4 (Wave 11).
--
-- The rls-coverage-report drifted to 142 missing (baseline 131) since
-- PRs #86/#87/#88. This migration closes every remaining gap with
-- static SQL — one ALTER TABLE + four CREATE POLICY statements per
-- table — so the audit script's regex-based scanner can see them
-- (the DO-block pattern in 0286/0288 works at runtime but is invisible
-- to scripts/audit-rls-coverage.mjs's static analyser).
--
-- Policy shape matches ADR-001:
--   USING/WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
--
-- One policy per CRUD verb (select / insert / update / delete) so each
-- can be tightened later without rewriting all four.
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is no-op if already enabled;
-- CREATE POLICY uses IF NOT EXISTS via a DO-EXISTS check per policy.

BEGIN;

-- ─── account ─────────────────────────────────────────────
ALTER TABLE IF EXISTS account ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS account FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account' AND policyname='account_tenant_select') THEN
    CREATE POLICY account_tenant_select ON account FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account' AND policyname='account_tenant_insert') THEN
    CREATE POLICY account_tenant_insert ON account FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account' AND policyname='account_tenant_update') THEN
    CREATE POLICY account_tenant_update ON account FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account' AND policyname='account_tenant_delete') THEN
    CREATE POLICY account_tenant_delete ON account FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ai_conformity_assessment ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ai_conformity_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_conformity_assessment FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_conformity_assessment' AND policyname='ai_conformity_assessment_tenant_select') THEN
    CREATE POLICY ai_conformity_assessment_tenant_select ON ai_conformity_assessment FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_conformity_assessment' AND policyname='ai_conformity_assessment_tenant_insert') THEN
    CREATE POLICY ai_conformity_assessment_tenant_insert ON ai_conformity_assessment FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_conformity_assessment' AND policyname='ai_conformity_assessment_tenant_update') THEN
    CREATE POLICY ai_conformity_assessment_tenant_update ON ai_conformity_assessment FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_conformity_assessment' AND policyname='ai_conformity_assessment_tenant_delete') THEN
    CREATE POLICY ai_conformity_assessment_tenant_delete ON ai_conformity_assessment FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ai_framework_mapping ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ai_framework_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_framework_mapping FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_framework_mapping' AND policyname='ai_framework_mapping_tenant_select') THEN
    CREATE POLICY ai_framework_mapping_tenant_select ON ai_framework_mapping FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_framework_mapping' AND policyname='ai_framework_mapping_tenant_insert') THEN
    CREATE POLICY ai_framework_mapping_tenant_insert ON ai_framework_mapping FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_framework_mapping' AND policyname='ai_framework_mapping_tenant_update') THEN
    CREATE POLICY ai_framework_mapping_tenant_update ON ai_framework_mapping FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_framework_mapping' AND policyname='ai_framework_mapping_tenant_delete') THEN
    CREATE POLICY ai_framework_mapping_tenant_delete ON ai_framework_mapping FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ai_fria ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ai_fria ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_fria FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_fria' AND policyname='ai_fria_tenant_select') THEN
    CREATE POLICY ai_fria_tenant_select ON ai_fria FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_fria' AND policyname='ai_fria_tenant_insert') THEN
    CREATE POLICY ai_fria_tenant_insert ON ai_fria FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_fria' AND policyname='ai_fria_tenant_update') THEN
    CREATE POLICY ai_fria_tenant_update ON ai_fria FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_fria' AND policyname='ai_fria_tenant_delete') THEN
    CREATE POLICY ai_fria_tenant_delete ON ai_fria FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ai_human_oversight_log ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ai_human_oversight_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_human_oversight_log FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_human_oversight_log' AND policyname='ai_human_oversight_log_tenant_select') THEN
    CREATE POLICY ai_human_oversight_log_tenant_select ON ai_human_oversight_log FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_human_oversight_log' AND policyname='ai_human_oversight_log_tenant_insert') THEN
    CREATE POLICY ai_human_oversight_log_tenant_insert ON ai_human_oversight_log FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_human_oversight_log' AND policyname='ai_human_oversight_log_tenant_update') THEN
    CREATE POLICY ai_human_oversight_log_tenant_update ON ai_human_oversight_log FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_human_oversight_log' AND policyname='ai_human_oversight_log_tenant_delete') THEN
    CREATE POLICY ai_human_oversight_log_tenant_delete ON ai_human_oversight_log FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ai_system ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ai_system ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_system FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_system' AND policyname='ai_system_tenant_select') THEN
    CREATE POLICY ai_system_tenant_select ON ai_system FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_system' AND policyname='ai_system_tenant_insert') THEN
    CREATE POLICY ai_system_tenant_insert ON ai_system FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_system' AND policyname='ai_system_tenant_update') THEN
    CREATE POLICY ai_system_tenant_update ON ai_system FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_system' AND policyname='ai_system_tenant_delete') THEN
    CREATE POLICY ai_system_tenant_delete ON ai_system FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ai_transparency_entry ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ai_transparency_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_transparency_entry FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_transparency_entry' AND policyname='ai_transparency_entry_tenant_select') THEN
    CREATE POLICY ai_transparency_entry_tenant_select ON ai_transparency_entry FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_transparency_entry' AND policyname='ai_transparency_entry_tenant_insert') THEN
    CREATE POLICY ai_transparency_entry_tenant_insert ON ai_transparency_entry FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_transparency_entry' AND policyname='ai_transparency_entry_tenant_update') THEN
    CREATE POLICY ai_transparency_entry_tenant_update ON ai_transparency_entry FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_transparency_entry' AND policyname='ai_transparency_entry_tenant_delete') THEN
    CREATE POLICY ai_transparency_entry_tenant_delete ON ai_transparency_entry FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── api_key_scope ─────────────────────────────────────────────
ALTER TABLE IF EXISTS api_key_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_key_scope FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_key_scope' AND policyname='api_key_scope_tenant_select') THEN
    CREATE POLICY api_key_scope_tenant_select ON api_key_scope FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_key_scope' AND policyname='api_key_scope_tenant_insert') THEN
    CREATE POLICY api_key_scope_tenant_insert ON api_key_scope FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_key_scope' AND policyname='api_key_scope_tenant_update') THEN
    CREATE POLICY api_key_scope_tenant_update ON api_key_scope FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_key_scope' AND policyname='api_key_scope_tenant_delete') THEN
    CREATE POLICY api_key_scope_tenant_delete ON api_key_scope FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── api_scope ─────────────────────────────────────────────
ALTER TABLE IF EXISTS api_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_scope FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_scope' AND policyname='api_scope_tenant_select') THEN
    CREATE POLICY api_scope_tenant_select ON api_scope FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_scope' AND policyname='api_scope_tenant_insert') THEN
    CREATE POLICY api_scope_tenant_insert ON api_scope FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_scope' AND policyname='api_scope_tenant_update') THEN
    CREATE POLICY api_scope_tenant_update ON api_scope FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_scope' AND policyname='api_scope_tenant_delete') THEN
    CREATE POLICY api_scope_tenant_delete ON api_scope FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── architecture_change_vote ─────────────────────────────────────────────
ALTER TABLE IF EXISTS architecture_change_vote ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS architecture_change_vote FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='architecture_change_vote' AND policyname='architecture_change_vote_tenant_select') THEN
    CREATE POLICY architecture_change_vote_tenant_select ON architecture_change_vote FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='architecture_change_vote' AND policyname='architecture_change_vote_tenant_insert') THEN
    CREATE POLICY architecture_change_vote_tenant_insert ON architecture_change_vote FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='architecture_change_vote' AND policyname='architecture_change_vote_tenant_update') THEN
    CREATE POLICY architecture_change_vote_tenant_update ON architecture_change_vote FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='architecture_change_vote' AND policyname='architecture_change_vote_tenant_delete') THEN
    CREATE POLICY architecture_change_vote_tenant_delete ON architecture_change_vote FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── assessment_control_eval ─────────────────────────────────────────────
ALTER TABLE IF EXISTS assessment_control_eval ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assessment_control_eval FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_control_eval' AND policyname='assessment_control_eval_tenant_select') THEN
    CREATE POLICY assessment_control_eval_tenant_select ON assessment_control_eval FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_control_eval' AND policyname='assessment_control_eval_tenant_insert') THEN
    CREATE POLICY assessment_control_eval_tenant_insert ON assessment_control_eval FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_control_eval' AND policyname='assessment_control_eval_tenant_update') THEN
    CREATE POLICY assessment_control_eval_tenant_update ON assessment_control_eval FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_control_eval' AND policyname='assessment_control_eval_tenant_delete') THEN
    CREATE POLICY assessment_control_eval_tenant_delete ON assessment_control_eval FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── assessment_risk_eval ─────────────────────────────────────────────
ALTER TABLE IF EXISTS assessment_risk_eval ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assessment_risk_eval FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_risk_eval' AND policyname='assessment_risk_eval_tenant_select') THEN
    CREATE POLICY assessment_risk_eval_tenant_select ON assessment_risk_eval FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_risk_eval' AND policyname='assessment_risk_eval_tenant_insert') THEN
    CREATE POLICY assessment_risk_eval_tenant_insert ON assessment_risk_eval FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_risk_eval' AND policyname='assessment_risk_eval_tenant_update') THEN
    CREATE POLICY assessment_risk_eval_tenant_update ON assessment_risk_eval FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_risk_eval' AND policyname='assessment_risk_eval_tenant_delete') THEN
    CREATE POLICY assessment_risk_eval_tenant_delete ON assessment_risk_eval FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── assessment_run ─────────────────────────────────────────────
ALTER TABLE IF EXISTS assessment_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assessment_run FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_run' AND policyname='assessment_run_tenant_select') THEN
    CREATE POLICY assessment_run_tenant_select ON assessment_run FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_run' AND policyname='assessment_run_tenant_insert') THEN
    CREATE POLICY assessment_run_tenant_insert ON assessment_run FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_run' AND policyname='assessment_run_tenant_update') THEN
    CREATE POLICY assessment_run_tenant_update ON assessment_run FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_run' AND policyname='assessment_run_tenant_delete') THEN
    CREATE POLICY assessment_run_tenant_delete ON assessment_run FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── asset_classification ─────────────────────────────────────────────
ALTER TABLE IF EXISTS asset_classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asset_classification FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='asset_classification' AND policyname='asset_classification_tenant_select') THEN
    CREATE POLICY asset_classification_tenant_select ON asset_classification FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='asset_classification' AND policyname='asset_classification_tenant_insert') THEN
    CREATE POLICY asset_classification_tenant_insert ON asset_classification FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='asset_classification' AND policyname='asset_classification_tenant_update') THEN
    CREATE POLICY asset_classification_tenant_update ON asset_classification FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='asset_classification' AND policyname='asset_classification_tenant_delete') THEN
    CREATE POLICY asset_classification_tenant_delete ON asset_classification FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── asset_type_risk_recommendation ─────────────────────────────────────────────
ALTER TABLE IF EXISTS asset_type_risk_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asset_type_risk_recommendation FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='asset_type_risk_recommendation' AND policyname='asset_type_risk_recommendation_tenant_select') THEN
    CREATE POLICY asset_type_risk_recommendation_tenant_select ON asset_type_risk_recommendation FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='asset_type_risk_recommendation' AND policyname='asset_type_risk_recommendation_tenant_insert') THEN
    CREATE POLICY asset_type_risk_recommendation_tenant_insert ON asset_type_risk_recommendation FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='asset_type_risk_recommendation' AND policyname='asset_type_risk_recommendation_tenant_update') THEN
    CREATE POLICY asset_type_risk_recommendation_tenant_update ON asset_type_risk_recommendation FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='asset_type_risk_recommendation' AND policyname='asset_type_risk_recommendation_tenant_delete') THEN
    CREATE POLICY asset_type_risk_recommendation_tenant_delete ON asset_type_risk_recommendation FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── audit_anchor ─────────────────────────────────────────────
ALTER TABLE IF EXISTS audit_anchor ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_anchor FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_anchor' AND policyname='audit_anchor_tenant_select') THEN
    CREATE POLICY audit_anchor_tenant_select ON audit_anchor FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_anchor' AND policyname='audit_anchor_tenant_insert') THEN
    CREATE POLICY audit_anchor_tenant_insert ON audit_anchor FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_anchor' AND policyname='audit_anchor_tenant_update') THEN
    CREATE POLICY audit_anchor_tenant_update ON audit_anchor FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_anchor' AND policyname='audit_anchor_tenant_delete') THEN
    CREATE POLICY audit_anchor_tenant_delete ON audit_anchor FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── audit_risk_prediction ─────────────────────────────────────────────
ALTER TABLE IF EXISTS audit_risk_prediction ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_risk_prediction FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_risk_prediction' AND policyname='audit_risk_prediction_tenant_select') THEN
    CREATE POLICY audit_risk_prediction_tenant_select ON audit_risk_prediction FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_risk_prediction' AND policyname='audit_risk_prediction_tenant_insert') THEN
    CREATE POLICY audit_risk_prediction_tenant_insert ON audit_risk_prediction FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_risk_prediction' AND policyname='audit_risk_prediction_tenant_update') THEN
    CREATE POLICY audit_risk_prediction_tenant_update ON audit_risk_prediction FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_risk_prediction' AND policyname='audit_risk_prediction_tenant_delete') THEN
    CREATE POLICY audit_risk_prediction_tenant_delete ON audit_risk_prediction FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── audit_risk_prediction_model ─────────────────────────────────────────────
ALTER TABLE IF EXISTS audit_risk_prediction_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_risk_prediction_model FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_risk_prediction_model' AND policyname='audit_risk_prediction_model_tenant_select') THEN
    CREATE POLICY audit_risk_prediction_model_tenant_select ON audit_risk_prediction_model FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_risk_prediction_model' AND policyname='audit_risk_prediction_model_tenant_insert') THEN
    CREATE POLICY audit_risk_prediction_model_tenant_insert ON audit_risk_prediction_model FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_risk_prediction_model' AND policyname='audit_risk_prediction_model_tenant_update') THEN
    CREATE POLICY audit_risk_prediction_model_tenant_update ON audit_risk_prediction_model FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_risk_prediction_model' AND policyname='audit_risk_prediction_model_tenant_delete') THEN
    CREATE POLICY audit_risk_prediction_model_tenant_delete ON audit_risk_prediction_model FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bc_exercise_finding ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bc_exercise_finding ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bc_exercise_finding FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_finding' AND policyname='bc_exercise_finding_tenant_select') THEN
    CREATE POLICY bc_exercise_finding_tenant_select ON bc_exercise_finding FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_finding' AND policyname='bc_exercise_finding_tenant_insert') THEN
    CREATE POLICY bc_exercise_finding_tenant_insert ON bc_exercise_finding FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_finding' AND policyname='bc_exercise_finding_tenant_update') THEN
    CREATE POLICY bc_exercise_finding_tenant_update ON bc_exercise_finding FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_finding' AND policyname='bc_exercise_finding_tenant_delete') THEN
    CREATE POLICY bc_exercise_finding_tenant_delete ON bc_exercise_finding FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bc_exercise_inject_log ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bc_exercise_inject_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bc_exercise_inject_log FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_inject_log' AND policyname='bc_exercise_inject_log_tenant_select') THEN
    CREATE POLICY bc_exercise_inject_log_tenant_select ON bc_exercise_inject_log FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_inject_log' AND policyname='bc_exercise_inject_log_tenant_insert') THEN
    CREATE POLICY bc_exercise_inject_log_tenant_insert ON bc_exercise_inject_log FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_inject_log' AND policyname='bc_exercise_inject_log_tenant_update') THEN
    CREATE POLICY bc_exercise_inject_log_tenant_update ON bc_exercise_inject_log FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_inject_log' AND policyname='bc_exercise_inject_log_tenant_delete') THEN
    CREATE POLICY bc_exercise_inject_log_tenant_delete ON bc_exercise_inject_log FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bc_exercise_scenario ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bc_exercise_scenario ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bc_exercise_scenario FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_scenario' AND policyname='bc_exercise_scenario_tenant_select') THEN
    CREATE POLICY bc_exercise_scenario_tenant_select ON bc_exercise_scenario FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_scenario' AND policyname='bc_exercise_scenario_tenant_insert') THEN
    CREATE POLICY bc_exercise_scenario_tenant_insert ON bc_exercise_scenario FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_scenario' AND policyname='bc_exercise_scenario_tenant_update') THEN
    CREATE POLICY bc_exercise_scenario_tenant_update ON bc_exercise_scenario FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bc_exercise_scenario' AND policyname='bc_exercise_scenario_tenant_delete') THEN
    CREATE POLICY bc_exercise_scenario_tenant_delete ON bc_exercise_scenario FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bcp ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bcp ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bcp FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp' AND policyname='bcp_tenant_select') THEN
    CREATE POLICY bcp_tenant_select ON bcp FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp' AND policyname='bcp_tenant_insert') THEN
    CREATE POLICY bcp_tenant_insert ON bcp FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp' AND policyname='bcp_tenant_update') THEN
    CREATE POLICY bcp_tenant_update ON bcp FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp' AND policyname='bcp_tenant_delete') THEN
    CREATE POLICY bcp_tenant_delete ON bcp FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bcp_procedure ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bcp_procedure ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bcp_procedure FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp_procedure' AND policyname='bcp_procedure_tenant_select') THEN
    CREATE POLICY bcp_procedure_tenant_select ON bcp_procedure FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp_procedure' AND policyname='bcp_procedure_tenant_insert') THEN
    CREATE POLICY bcp_procedure_tenant_insert ON bcp_procedure FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp_procedure' AND policyname='bcp_procedure_tenant_update') THEN
    CREATE POLICY bcp_procedure_tenant_update ON bcp_procedure FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp_procedure' AND policyname='bcp_procedure_tenant_delete') THEN
    CREATE POLICY bcp_procedure_tenant_delete ON bcp_procedure FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bcp_resource ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bcp_resource ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bcp_resource FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp_resource' AND policyname='bcp_resource_tenant_select') THEN
    CREATE POLICY bcp_resource_tenant_select ON bcp_resource FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp_resource' AND policyname='bcp_resource_tenant_insert') THEN
    CREATE POLICY bcp_resource_tenant_insert ON bcp_resource FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp_resource' AND policyname='bcp_resource_tenant_update') THEN
    CREATE POLICY bcp_resource_tenant_update ON bcp_resource FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bcp_resource' AND policyname='bcp_resource_tenant_delete') THEN
    CREATE POLICY bcp_resource_tenant_delete ON bcp_resource FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── benchmark_pool ─────────────────────────────────────────────
ALTER TABLE IF EXISTS benchmark_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS benchmark_pool FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='benchmark_pool' AND policyname='benchmark_pool_tenant_select') THEN
    CREATE POLICY benchmark_pool_tenant_select ON benchmark_pool FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='benchmark_pool' AND policyname='benchmark_pool_tenant_insert') THEN
    CREATE POLICY benchmark_pool_tenant_insert ON benchmark_pool FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='benchmark_pool' AND policyname='benchmark_pool_tenant_update') THEN
    CREATE POLICY benchmark_pool_tenant_update ON benchmark_pool FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='benchmark_pool' AND policyname='benchmark_pool_tenant_delete') THEN
    CREATE POLICY benchmark_pool_tenant_delete ON benchmark_pool FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bia_assessment ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bia_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bia_assessment FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_assessment' AND policyname='bia_assessment_tenant_select') THEN
    CREATE POLICY bia_assessment_tenant_select ON bia_assessment FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_assessment' AND policyname='bia_assessment_tenant_insert') THEN
    CREATE POLICY bia_assessment_tenant_insert ON bia_assessment FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_assessment' AND policyname='bia_assessment_tenant_update') THEN
    CREATE POLICY bia_assessment_tenant_update ON bia_assessment FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_assessment' AND policyname='bia_assessment_tenant_delete') THEN
    CREATE POLICY bia_assessment_tenant_delete ON bia_assessment FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bia_process_impact ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bia_process_impact ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bia_process_impact FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_process_impact' AND policyname='bia_process_impact_tenant_select') THEN
    CREATE POLICY bia_process_impact_tenant_select ON bia_process_impact FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_process_impact' AND policyname='bia_process_impact_tenant_insert') THEN
    CREATE POLICY bia_process_impact_tenant_insert ON bia_process_impact FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_process_impact' AND policyname='bia_process_impact_tenant_update') THEN
    CREATE POLICY bia_process_impact_tenant_update ON bia_process_impact FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_process_impact' AND policyname='bia_process_impact_tenant_delete') THEN
    CREATE POLICY bia_process_impact_tenant_delete ON bia_process_impact FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bia_supplier_dependency ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bia_supplier_dependency ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bia_supplier_dependency FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_supplier_dependency' AND policyname='bia_supplier_dependency_tenant_select') THEN
    CREATE POLICY bia_supplier_dependency_tenant_select ON bia_supplier_dependency FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_supplier_dependency' AND policyname='bia_supplier_dependency_tenant_insert') THEN
    CREATE POLICY bia_supplier_dependency_tenant_insert ON bia_supplier_dependency FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_supplier_dependency' AND policyname='bia_supplier_dependency_tenant_update') THEN
    CREATE POLICY bia_supplier_dependency_tenant_update ON bia_supplier_dependency FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bia_supplier_dependency' AND policyname='bia_supplier_dependency_tenant_delete') THEN
    CREATE POLICY bia_supplier_dependency_tenant_delete ON bia_supplier_dependency FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bowtie_path ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bowtie_path ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bowtie_path FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bowtie_path' AND policyname='bowtie_path_tenant_select') THEN
    CREATE POLICY bowtie_path_tenant_select ON bowtie_path FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bowtie_path' AND policyname='bowtie_path_tenant_insert') THEN
    CREATE POLICY bowtie_path_tenant_insert ON bowtie_path FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bowtie_path' AND policyname='bowtie_path_tenant_update') THEN
    CREATE POLICY bowtie_path_tenant_update ON bowtie_path FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bowtie_path' AND policyname='bowtie_path_tenant_delete') THEN
    CREATE POLICY bowtie_path_tenant_delete ON bowtie_path FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── bowtie_template ─────────────────────────────────────────────
ALTER TABLE IF EXISTS bowtie_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bowtie_template FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bowtie_template' AND policyname='bowtie_template_tenant_select') THEN
    CREATE POLICY bowtie_template_tenant_select ON bowtie_template FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bowtie_template' AND policyname='bowtie_template_tenant_insert') THEN
    CREATE POLICY bowtie_template_tenant_insert ON bowtie_template FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bowtie_template' AND policyname='bowtie_template_tenant_update') THEN
    CREATE POLICY bowtie_template_tenant_update ON bowtie_template FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bowtie_template' AND policyname='bowtie_template_tenant_delete') THEN
    CREATE POLICY bowtie_template_tenant_delete ON bowtie_template FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── catalog_lifecycle_phase ─────────────────────────────────────────────
ALTER TABLE IF EXISTS catalog_lifecycle_phase ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS catalog_lifecycle_phase FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_lifecycle_phase' AND policyname='catalog_lifecycle_phase_tenant_select') THEN
    CREATE POLICY catalog_lifecycle_phase_tenant_select ON catalog_lifecycle_phase FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_lifecycle_phase' AND policyname='catalog_lifecycle_phase_tenant_insert') THEN
    CREATE POLICY catalog_lifecycle_phase_tenant_insert ON catalog_lifecycle_phase FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_lifecycle_phase' AND policyname='catalog_lifecycle_phase_tenant_update') THEN
    CREATE POLICY catalog_lifecycle_phase_tenant_update ON catalog_lifecycle_phase FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_lifecycle_phase' AND policyname='catalog_lifecycle_phase_tenant_delete') THEN
    CREATE POLICY catalog_lifecycle_phase_tenant_delete ON catalog_lifecycle_phase FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── cloud_service_catalog ─────────────────────────────────────────────
ALTER TABLE IF EXISTS cloud_service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cloud_service_catalog FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cloud_service_catalog' AND policyname='cloud_service_catalog_tenant_select') THEN
    CREATE POLICY cloud_service_catalog_tenant_select ON cloud_service_catalog FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cloud_service_catalog' AND policyname='cloud_service_catalog_tenant_insert') THEN
    CREATE POLICY cloud_service_catalog_tenant_insert ON cloud_service_catalog FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cloud_service_catalog' AND policyname='cloud_service_catalog_tenant_update') THEN
    CREATE POLICY cloud_service_catalog_tenant_update ON cloud_service_catalog FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cloud_service_catalog' AND policyname='cloud_service_catalog_tenant_delete') THEN
    CREATE POLICY cloud_service_catalog_tenant_delete ON cloud_service_catalog FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── continuity_strategy ─────────────────────────────────────────────
ALTER TABLE IF EXISTS continuity_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS continuity_strategy FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='continuity_strategy' AND policyname='continuity_strategy_tenant_select') THEN
    CREATE POLICY continuity_strategy_tenant_select ON continuity_strategy FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='continuity_strategy' AND policyname='continuity_strategy_tenant_insert') THEN
    CREATE POLICY continuity_strategy_tenant_insert ON continuity_strategy FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='continuity_strategy' AND policyname='continuity_strategy_tenant_update') THEN
    CREATE POLICY continuity_strategy_tenant_update ON continuity_strategy FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='continuity_strategy' AND policyname='continuity_strategy_tenant_delete') THEN
    CREATE POLICY continuity_strategy_tenant_delete ON continuity_strategy FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── contract ─────────────────────────────────────────────
ALTER TABLE IF EXISTS contract ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contract FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract' AND policyname='contract_tenant_select') THEN
    CREATE POLICY contract_tenant_select ON contract FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract' AND policyname='contract_tenant_insert') THEN
    CREATE POLICY contract_tenant_insert ON contract FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract' AND policyname='contract_tenant_update') THEN
    CREATE POLICY contract_tenant_update ON contract FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract' AND policyname='contract_tenant_delete') THEN
    CREATE POLICY contract_tenant_delete ON contract FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── contract_amendment ─────────────────────────────────────────────
ALTER TABLE IF EXISTS contract_amendment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contract_amendment FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_amendment' AND policyname='contract_amendment_tenant_select') THEN
    CREATE POLICY contract_amendment_tenant_select ON contract_amendment FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_amendment' AND policyname='contract_amendment_tenant_insert') THEN
    CREATE POLICY contract_amendment_tenant_insert ON contract_amendment FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_amendment' AND policyname='contract_amendment_tenant_update') THEN
    CREATE POLICY contract_amendment_tenant_update ON contract_amendment FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_amendment' AND policyname='contract_amendment_tenant_delete') THEN
    CREATE POLICY contract_amendment_tenant_delete ON contract_amendment FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── contract_obligation ─────────────────────────────────────────────
ALTER TABLE IF EXISTS contract_obligation ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contract_obligation FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_obligation' AND policyname='contract_obligation_tenant_select') THEN
    CREATE POLICY contract_obligation_tenant_select ON contract_obligation FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_obligation' AND policyname='contract_obligation_tenant_insert') THEN
    CREATE POLICY contract_obligation_tenant_insert ON contract_obligation FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_obligation' AND policyname='contract_obligation_tenant_update') THEN
    CREATE POLICY contract_obligation_tenant_update ON contract_obligation FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_obligation' AND policyname='contract_obligation_tenant_delete') THEN
    CREATE POLICY contract_obligation_tenant_delete ON contract_obligation FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── contract_sla ─────────────────────────────────────────────
ALTER TABLE IF EXISTS contract_sla ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contract_sla FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_sla' AND policyname='contract_sla_tenant_select') THEN
    CREATE POLICY contract_sla_tenant_select ON contract_sla FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_sla' AND policyname='contract_sla_tenant_insert') THEN
    CREATE POLICY contract_sla_tenant_insert ON contract_sla FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_sla' AND policyname='contract_sla_tenant_update') THEN
    CREATE POLICY contract_sla_tenant_update ON contract_sla FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_sla' AND policyname='contract_sla_tenant_delete') THEN
    CREATE POLICY contract_sla_tenant_delete ON contract_sla FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── contract_sla_measurement ─────────────────────────────────────────────
ALTER TABLE IF EXISTS contract_sla_measurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contract_sla_measurement FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_sla_measurement' AND policyname='contract_sla_measurement_tenant_select') THEN
    CREATE POLICY contract_sla_measurement_tenant_select ON contract_sla_measurement FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_sla_measurement' AND policyname='contract_sla_measurement_tenant_insert') THEN
    CREATE POLICY contract_sla_measurement_tenant_insert ON contract_sla_measurement FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_sla_measurement' AND policyname='contract_sla_measurement_tenant_update') THEN
    CREATE POLICY contract_sla_measurement_tenant_update ON contract_sla_measurement FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_sla_measurement' AND policyname='contract_sla_measurement_tenant_delete') THEN
    CREATE POLICY contract_sla_measurement_tenant_delete ON contract_sla_measurement FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── control_catalog ─────────────────────────────────────────────
ALTER TABLE IF EXISTS control_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS control_catalog FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_catalog' AND policyname='control_catalog_tenant_select') THEN
    CREATE POLICY control_catalog_tenant_select ON control_catalog FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_catalog' AND policyname='control_catalog_tenant_insert') THEN
    CREATE POLICY control_catalog_tenant_insert ON control_catalog FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_catalog' AND policyname='control_catalog_tenant_update') THEN
    CREATE POLICY control_catalog_tenant_update ON control_catalog FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_catalog' AND policyname='control_catalog_tenant_delete') THEN
    CREATE POLICY control_catalog_tenant_delete ON control_catalog FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── control_catalog_entry ─────────────────────────────────────────────
ALTER TABLE IF EXISTS control_catalog_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS control_catalog_entry FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_catalog_entry' AND policyname='control_catalog_entry_tenant_select') THEN
    CREATE POLICY control_catalog_entry_tenant_select ON control_catalog_entry FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_catalog_entry' AND policyname='control_catalog_entry_tenant_insert') THEN
    CREATE POLICY control_catalog_entry_tenant_insert ON control_catalog_entry FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_catalog_entry' AND policyname='control_catalog_entry_tenant_update') THEN
    CREATE POLICY control_catalog_entry_tenant_update ON control_catalog_entry FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_catalog_entry' AND policyname='control_catalog_entry_tenant_delete') THEN
    CREATE POLICY control_catalog_entry_tenant_delete ON control_catalog_entry FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── control_library_entry ─────────────────────────────────────────────
ALTER TABLE IF EXISTS control_library_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS control_library_entry FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_library_entry' AND policyname='control_library_entry_tenant_select') THEN
    CREATE POLICY control_library_entry_tenant_select ON control_library_entry FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_library_entry' AND policyname='control_library_entry_tenant_insert') THEN
    CREATE POLICY control_library_entry_tenant_insert ON control_library_entry FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_library_entry' AND policyname='control_library_entry_tenant_update') THEN
    CREATE POLICY control_library_entry_tenant_update ON control_library_entry FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_library_entry' AND policyname='control_library_entry_tenant_delete') THEN
    CREATE POLICY control_library_entry_tenant_delete ON control_library_entry FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── control_maturity ─────────────────────────────────────────────
ALTER TABLE IF EXISTS control_maturity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS control_maturity FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_maturity' AND policyname='control_maturity_tenant_select') THEN
    CREATE POLICY control_maturity_tenant_select ON control_maturity FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_maturity' AND policyname='control_maturity_tenant_insert') THEN
    CREATE POLICY control_maturity_tenant_insert ON control_maturity FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_maturity' AND policyname='control_maturity_tenant_update') THEN
    CREATE POLICY control_maturity_tenant_update ON control_maturity FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='control_maturity' AND policyname='control_maturity_tenant_delete') THEN
    CREATE POLICY control_maturity_tenant_delete ON control_maturity FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── country_risk_profile ─────────────────────────────────────────────
ALTER TABLE IF EXISTS country_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS country_risk_profile FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='country_risk_profile' AND policyname='country_risk_profile_tenant_select') THEN
    CREATE POLICY country_risk_profile_tenant_select ON country_risk_profile FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='country_risk_profile' AND policyname='country_risk_profile_tenant_insert') THEN
    CREATE POLICY country_risk_profile_tenant_insert ON country_risk_profile FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='country_risk_profile' AND policyname='country_risk_profile_tenant_update') THEN
    CREATE POLICY country_risk_profile_tenant_update ON country_risk_profile FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='country_risk_profile' AND policyname='country_risk_profile_tenant_delete') THEN
    CREATE POLICY country_risk_profile_tenant_delete ON country_risk_profile FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── crisis_contact_node ─────────────────────────────────────────────
ALTER TABLE IF EXISTS crisis_contact_node ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crisis_contact_node FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_contact_node' AND policyname='crisis_contact_node_tenant_select') THEN
    CREATE POLICY crisis_contact_node_tenant_select ON crisis_contact_node FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_contact_node' AND policyname='crisis_contact_node_tenant_insert') THEN
    CREATE POLICY crisis_contact_node_tenant_insert ON crisis_contact_node FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_contact_node' AND policyname='crisis_contact_node_tenant_update') THEN
    CREATE POLICY crisis_contact_node_tenant_update ON crisis_contact_node FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_contact_node' AND policyname='crisis_contact_node_tenant_delete') THEN
    CREATE POLICY crisis_contact_node_tenant_delete ON crisis_contact_node FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── crisis_log ─────────────────────────────────────────────
ALTER TABLE IF EXISTS crisis_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crisis_log FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_log' AND policyname='crisis_log_tenant_select') THEN
    CREATE POLICY crisis_log_tenant_select ON crisis_log FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_log' AND policyname='crisis_log_tenant_insert') THEN
    CREATE POLICY crisis_log_tenant_insert ON crisis_log FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_log' AND policyname='crisis_log_tenant_update') THEN
    CREATE POLICY crisis_log_tenant_update ON crisis_log FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_log' AND policyname='crisis_log_tenant_delete') THEN
    CREATE POLICY crisis_log_tenant_delete ON crisis_log FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── crisis_scenario ─────────────────────────────────────────────
ALTER TABLE IF EXISTS crisis_scenario ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crisis_scenario FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_scenario' AND policyname='crisis_scenario_tenant_select') THEN
    CREATE POLICY crisis_scenario_tenant_select ON crisis_scenario FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_scenario' AND policyname='crisis_scenario_tenant_insert') THEN
    CREATE POLICY crisis_scenario_tenant_insert ON crisis_scenario FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_scenario' AND policyname='crisis_scenario_tenant_update') THEN
    CREATE POLICY crisis_scenario_tenant_update ON crisis_scenario FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_scenario' AND policyname='crisis_scenario_tenant_delete') THEN
    CREATE POLICY crisis_scenario_tenant_delete ON crisis_scenario FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── crisis_team_member ─────────────────────────────────────────────
ALTER TABLE IF EXISTS crisis_team_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crisis_team_member FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_team_member' AND policyname='crisis_team_member_tenant_select') THEN
    CREATE POLICY crisis_team_member_tenant_select ON crisis_team_member FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_team_member' AND policyname='crisis_team_member_tenant_insert') THEN
    CREATE POLICY crisis_team_member_tenant_insert ON crisis_team_member FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_team_member' AND policyname='crisis_team_member_tenant_update') THEN
    CREATE POLICY crisis_team_member_tenant_update ON crisis_team_member FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_team_member' AND policyname='crisis_team_member_tenant_delete') THEN
    CREATE POLICY crisis_team_member_tenant_delete ON crisis_team_member FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── custom_dashboard_widget ─────────────────────────────────────────────
ALTER TABLE IF EXISTS custom_dashboard_widget ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_dashboard_widget FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_dashboard_widget' AND policyname='custom_dashboard_widget_tenant_select') THEN
    CREATE POLICY custom_dashboard_widget_tenant_select ON custom_dashboard_widget FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_dashboard_widget' AND policyname='custom_dashboard_widget_tenant_insert') THEN
    CREATE POLICY custom_dashboard_widget_tenant_insert ON custom_dashboard_widget FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_dashboard_widget' AND policyname='custom_dashboard_widget_tenant_update') THEN
    CREATE POLICY custom_dashboard_widget_tenant_update ON custom_dashboard_widget FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_dashboard_widget' AND policyname='custom_dashboard_widget_tenant_delete') THEN
    CREATE POLICY custom_dashboard_widget_tenant_delete ON custom_dashboard_widget FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── cve_feed_item ─────────────────────────────────────────────
ALTER TABLE IF EXISTS cve_feed_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cve_feed_item FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cve_feed_item' AND policyname='cve_feed_item_tenant_select') THEN
    CREATE POLICY cve_feed_item_tenant_select ON cve_feed_item FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cve_feed_item' AND policyname='cve_feed_item_tenant_insert') THEN
    CREATE POLICY cve_feed_item_tenant_insert ON cve_feed_item FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cve_feed_item' AND policyname='cve_feed_item_tenant_update') THEN
    CREATE POLICY cve_feed_item_tenant_update ON cve_feed_item FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cve_feed_item' AND policyname='cve_feed_item_tenant_delete') THEN
    CREATE POLICY cve_feed_item_tenant_delete ON cve_feed_item FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── data_breach ─────────────────────────────────────────────
ALTER TABLE IF EXISTS data_breach ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS data_breach FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_breach' AND policyname='data_breach_tenant_select') THEN
    CREATE POLICY data_breach_tenant_select ON data_breach FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_breach' AND policyname='data_breach_tenant_insert') THEN
    CREATE POLICY data_breach_tenant_insert ON data_breach FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_breach' AND policyname='data_breach_tenant_update') THEN
    CREATE POLICY data_breach_tenant_update ON data_breach FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_breach' AND policyname='data_breach_tenant_delete') THEN
    CREATE POLICY data_breach_tenant_delete ON data_breach FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── data_breach_notification ─────────────────────────────────────────────
ALTER TABLE IF EXISTS data_breach_notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS data_breach_notification FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_breach_notification' AND policyname='data_breach_notification_tenant_select') THEN
    CREATE POLICY data_breach_notification_tenant_select ON data_breach_notification FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_breach_notification' AND policyname='data_breach_notification_tenant_insert') THEN
    CREATE POLICY data_breach_notification_tenant_insert ON data_breach_notification FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_breach_notification' AND policyname='data_breach_notification_tenant_update') THEN
    CREATE POLICY data_breach_notification_tenant_update ON data_breach_notification FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_breach_notification' AND policyname='data_breach_notification_tenant_delete') THEN
    CREATE POLICY data_breach_notification_tenant_delete ON data_breach_notification FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── data_region ─────────────────────────────────────────────
ALTER TABLE IF EXISTS data_region ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS data_region FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_region' AND policyname='data_region_tenant_select') THEN
    CREATE POLICY data_region_tenant_select ON data_region FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_region' AND policyname='data_region_tenant_insert') THEN
    CREATE POLICY data_region_tenant_insert ON data_region FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_region' AND policyname='data_region_tenant_update') THEN
    CREATE POLICY data_region_tenant_update ON data_region FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_region' AND policyname='data_region_tenant_delete') THEN
    CREATE POLICY data_region_tenant_delete ON data_region FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── dd_evidence ─────────────────────────────────────────────
ALTER TABLE IF EXISTS dd_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_evidence FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_evidence' AND policyname='dd_evidence_tenant_select') THEN
    CREATE POLICY dd_evidence_tenant_select ON dd_evidence FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_evidence' AND policyname='dd_evidence_tenant_insert') THEN
    CREATE POLICY dd_evidence_tenant_insert ON dd_evidence FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_evidence' AND policyname='dd_evidence_tenant_update') THEN
    CREATE POLICY dd_evidence_tenant_update ON dd_evidence FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_evidence' AND policyname='dd_evidence_tenant_delete') THEN
    CREATE POLICY dd_evidence_tenant_delete ON dd_evidence FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── dd_response ─────────────────────────────────────────────
ALTER TABLE IF EXISTS dd_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_response FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_response' AND policyname='dd_response_tenant_select') THEN
    CREATE POLICY dd_response_tenant_select ON dd_response FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_response' AND policyname='dd_response_tenant_insert') THEN
    CREATE POLICY dd_response_tenant_insert ON dd_response FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_response' AND policyname='dd_response_tenant_update') THEN
    CREATE POLICY dd_response_tenant_update ON dd_response FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_response' AND policyname='dd_response_tenant_delete') THEN
    CREATE POLICY dd_response_tenant_delete ON dd_response FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── dd_session ─────────────────────────────────────────────
ALTER TABLE IF EXISTS dd_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dd_session FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_session' AND policyname='dd_session_tenant_select') THEN
    CREATE POLICY dd_session_tenant_select ON dd_session FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_session' AND policyname='dd_session_tenant_insert') THEN
    CREATE POLICY dd_session_tenant_insert ON dd_session FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_session' AND policyname='dd_session_tenant_update') THEN
    CREATE POLICY dd_session_tenant_update ON dd_session FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dd_session' AND policyname='dd_session_tenant_delete') THEN
    CREATE POLICY dd_session_tenant_delete ON dd_session FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── dpia ─────────────────────────────────────────────
ALTER TABLE IF EXISTS dpia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dpia FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia' AND policyname='dpia_tenant_select') THEN
    CREATE POLICY dpia_tenant_select ON dpia FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia' AND policyname='dpia_tenant_insert') THEN
    CREATE POLICY dpia_tenant_insert ON dpia FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia' AND policyname='dpia_tenant_update') THEN
    CREATE POLICY dpia_tenant_update ON dpia FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia' AND policyname='dpia_tenant_delete') THEN
    CREATE POLICY dpia_tenant_delete ON dpia FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── dpia_measure ─────────────────────────────────────────────
ALTER TABLE IF EXISTS dpia_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dpia_measure FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia_measure' AND policyname='dpia_measure_tenant_select') THEN
    CREATE POLICY dpia_measure_tenant_select ON dpia_measure FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia_measure' AND policyname='dpia_measure_tenant_insert') THEN
    CREATE POLICY dpia_measure_tenant_insert ON dpia_measure FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia_measure' AND policyname='dpia_measure_tenant_update') THEN
    CREATE POLICY dpia_measure_tenant_update ON dpia_measure FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia_measure' AND policyname='dpia_measure_tenant_delete') THEN
    CREATE POLICY dpia_measure_tenant_delete ON dpia_measure FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── dpia_risk ─────────────────────────────────────────────
ALTER TABLE IF EXISTS dpia_risk ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dpia_risk FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia_risk' AND policyname='dpia_risk_tenant_select') THEN
    CREATE POLICY dpia_risk_tenant_select ON dpia_risk FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia_risk' AND policyname='dpia_risk_tenant_insert') THEN
    CREATE POLICY dpia_risk_tenant_insert ON dpia_risk FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia_risk' AND policyname='dpia_risk_tenant_update') THEN
    CREATE POLICY dpia_risk_tenant_update ON dpia_risk FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dpia_risk' AND policyname='dpia_risk_tenant_delete') THEN
    CREATE POLICY dpia_risk_tenant_delete ON dpia_risk FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── dsr ─────────────────────────────────────────────
ALTER TABLE IF EXISTS dsr ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dsr FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dsr' AND policyname='dsr_tenant_select') THEN
    CREATE POLICY dsr_tenant_select ON dsr FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dsr' AND policyname='dsr_tenant_insert') THEN
    CREATE POLICY dsr_tenant_insert ON dsr FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dsr' AND policyname='dsr_tenant_update') THEN
    CREATE POLICY dsr_tenant_update ON dsr FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dsr' AND policyname='dsr_tenant_delete') THEN
    CREATE POLICY dsr_tenant_delete ON dsr FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── dsr_activity ─────────────────────────────────────────────
ALTER TABLE IF EXISTS dsr_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dsr_activity FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dsr_activity' AND policyname='dsr_activity_tenant_select') THEN
    CREATE POLICY dsr_activity_tenant_select ON dsr_activity FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dsr_activity' AND policyname='dsr_activity_tenant_insert') THEN
    CREATE POLICY dsr_activity_tenant_insert ON dsr_activity FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dsr_activity' AND policyname='dsr_activity_tenant_update') THEN
    CREATE POLICY dsr_activity_tenant_update ON dsr_activity FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dsr_activity' AND policyname='dsr_activity_tenant_delete') THEN
    CREATE POLICY dsr_activity_tenant_delete ON dsr_activity FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esg_annual_report ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esg_annual_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esg_annual_report FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_annual_report' AND policyname='esg_annual_report_tenant_select') THEN
    CREATE POLICY esg_annual_report_tenant_select ON esg_annual_report FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_annual_report' AND policyname='esg_annual_report_tenant_insert') THEN
    CREATE POLICY esg_annual_report_tenant_insert ON esg_annual_report FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_annual_report' AND policyname='esg_annual_report_tenant_update') THEN
    CREATE POLICY esg_annual_report_tenant_update ON esg_annual_report FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_annual_report' AND policyname='esg_annual_report_tenant_delete') THEN
    CREATE POLICY esg_annual_report_tenant_delete ON esg_annual_report FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esg_control_link ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esg_control_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esg_control_link FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_control_link' AND policyname='esg_control_link_tenant_select') THEN
    CREATE POLICY esg_control_link_tenant_select ON esg_control_link FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_control_link' AND policyname='esg_control_link_tenant_insert') THEN
    CREATE POLICY esg_control_link_tenant_insert ON esg_control_link FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_control_link' AND policyname='esg_control_link_tenant_update') THEN
    CREATE POLICY esg_control_link_tenant_update ON esg_control_link FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_control_link' AND policyname='esg_control_link_tenant_delete') THEN
    CREATE POLICY esg_control_link_tenant_delete ON esg_control_link FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esg_materiality_assessment ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esg_materiality_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esg_materiality_assessment FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_assessment' AND policyname='esg_materiality_assessment_tenant_select') THEN
    CREATE POLICY esg_materiality_assessment_tenant_select ON esg_materiality_assessment FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_assessment' AND policyname='esg_materiality_assessment_tenant_insert') THEN
    CREATE POLICY esg_materiality_assessment_tenant_insert ON esg_materiality_assessment FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_assessment' AND policyname='esg_materiality_assessment_tenant_update') THEN
    CREATE POLICY esg_materiality_assessment_tenant_update ON esg_materiality_assessment FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_assessment' AND policyname='esg_materiality_assessment_tenant_delete') THEN
    CREATE POLICY esg_materiality_assessment_tenant_delete ON esg_materiality_assessment FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esg_materiality_topic ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esg_materiality_topic ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esg_materiality_topic FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_topic' AND policyname='esg_materiality_topic_tenant_select') THEN
    CREATE POLICY esg_materiality_topic_tenant_select ON esg_materiality_topic FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_topic' AND policyname='esg_materiality_topic_tenant_insert') THEN
    CREATE POLICY esg_materiality_topic_tenant_insert ON esg_materiality_topic FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_topic' AND policyname='esg_materiality_topic_tenant_update') THEN
    CREATE POLICY esg_materiality_topic_tenant_update ON esg_materiality_topic FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_topic' AND policyname='esg_materiality_topic_tenant_delete') THEN
    CREATE POLICY esg_materiality_topic_tenant_delete ON esg_materiality_topic FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esg_materiality_vote ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esg_materiality_vote ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esg_materiality_vote FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_vote' AND policyname='esg_materiality_vote_tenant_select') THEN
    CREATE POLICY esg_materiality_vote_tenant_select ON esg_materiality_vote FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_vote' AND policyname='esg_materiality_vote_tenant_insert') THEN
    CREATE POLICY esg_materiality_vote_tenant_insert ON esg_materiality_vote FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_vote' AND policyname='esg_materiality_vote_tenant_update') THEN
    CREATE POLICY esg_materiality_vote_tenant_update ON esg_materiality_vote FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_materiality_vote' AND policyname='esg_materiality_vote_tenant_delete') THEN
    CREATE POLICY esg_materiality_vote_tenant_delete ON esg_materiality_vote FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esg_measurement ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esg_measurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esg_measurement FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_measurement' AND policyname='esg_measurement_tenant_select') THEN
    CREATE POLICY esg_measurement_tenant_select ON esg_measurement FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_measurement' AND policyname='esg_measurement_tenant_insert') THEN
    CREATE POLICY esg_measurement_tenant_insert ON esg_measurement FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_measurement' AND policyname='esg_measurement_tenant_update') THEN
    CREATE POLICY esg_measurement_tenant_update ON esg_measurement FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_measurement' AND policyname='esg_measurement_tenant_delete') THEN
    CREATE POLICY esg_measurement_tenant_delete ON esg_measurement FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esg_target ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esg_target ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esg_target FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_target' AND policyname='esg_target_tenant_select') THEN
    CREATE POLICY esg_target_tenant_select ON esg_target FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_target' AND policyname='esg_target_tenant_insert') THEN
    CREATE POLICY esg_target_tenant_insert ON esg_target FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_target' AND policyname='esg_target_tenant_update') THEN
    CREATE POLICY esg_target_tenant_update ON esg_target FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esg_target' AND policyname='esg_target_tenant_delete') THEN
    CREATE POLICY esg_target_tenant_delete ON esg_target FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esrs_datapoint_definition ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esrs_datapoint_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esrs_datapoint_definition FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esrs_datapoint_definition' AND policyname='esrs_datapoint_definition_tenant_select') THEN
    CREATE POLICY esrs_datapoint_definition_tenant_select ON esrs_datapoint_definition FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esrs_datapoint_definition' AND policyname='esrs_datapoint_definition_tenant_insert') THEN
    CREATE POLICY esrs_datapoint_definition_tenant_insert ON esrs_datapoint_definition FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esrs_datapoint_definition' AND policyname='esrs_datapoint_definition_tenant_update') THEN
    CREATE POLICY esrs_datapoint_definition_tenant_update ON esrs_datapoint_definition FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esrs_datapoint_definition' AND policyname='esrs_datapoint_definition_tenant_delete') THEN
    CREATE POLICY esrs_datapoint_definition_tenant_delete ON esrs_datapoint_definition FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── esrs_metric ─────────────────────────────────────────────
ALTER TABLE IF EXISTS esrs_metric ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS esrs_metric FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esrs_metric' AND policyname='esrs_metric_tenant_select') THEN
    CREATE POLICY esrs_metric_tenant_select ON esrs_metric FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esrs_metric' AND policyname='esrs_metric_tenant_insert') THEN
    CREATE POLICY esrs_metric_tenant_insert ON esrs_metric FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esrs_metric' AND policyname='esrs_metric_tenant_update') THEN
    CREATE POLICY esrs_metric_tenant_update ON esrs_metric FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='esrs_metric' AND policyname='esrs_metric_tenant_delete') THEN
    CREATE POLICY esrs_metric_tenant_delete ON esrs_metric FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── essential_process ─────────────────────────────────────────────
ALTER TABLE IF EXISTS essential_process ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS essential_process FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='essential_process' AND policyname='essential_process_tenant_select') THEN
    CREATE POLICY essential_process_tenant_select ON essential_process FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='essential_process' AND policyname='essential_process_tenant_insert') THEN
    CREATE POLICY essential_process_tenant_insert ON essential_process FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='essential_process' AND policyname='essential_process_tenant_update') THEN
    CREATE POLICY essential_process_tenant_update ON essential_process FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='essential_process' AND policyname='essential_process_tenant_delete') THEN
    CREATE POLICY essential_process_tenant_delete ON essential_process FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── extension_marketplace ─────────────────────────────────────────────
ALTER TABLE IF EXISTS extension_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS extension_marketplace FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='extension_marketplace' AND policyname='extension_marketplace_tenant_select') THEN
    CREATE POLICY extension_marketplace_tenant_select ON extension_marketplace FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='extension_marketplace' AND policyname='extension_marketplace_tenant_insert') THEN
    CREATE POLICY extension_marketplace_tenant_insert ON extension_marketplace FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='extension_marketplace' AND policyname='extension_marketplace_tenant_update') THEN
    CREATE POLICY extension_marketplace_tenant_update ON extension_marketplace FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='extension_marketplace' AND policyname='extension_marketplace_tenant_delete') THEN
    CREATE POLICY extension_marketplace_tenant_delete ON extension_marketplace FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── feature_gate ─────────────────────────────────────────────
ALTER TABLE IF EXISTS feature_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feature_gate FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_gate' AND policyname='feature_gate_tenant_select') THEN
    CREATE POLICY feature_gate_tenant_select ON feature_gate FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_gate' AND policyname='feature_gate_tenant_insert') THEN
    CREATE POLICY feature_gate_tenant_insert ON feature_gate FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_gate' AND policyname='feature_gate_tenant_update') THEN
    CREATE POLICY feature_gate_tenant_update ON feature_gate FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_gate' AND policyname='feature_gate_tenant_delete') THEN
    CREATE POLICY feature_gate_tenant_delete ON feature_gate FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── framework_mapping ─────────────────────────────────────────────
ALTER TABLE IF EXISTS framework_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS framework_mapping FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='framework_mapping' AND policyname='framework_mapping_tenant_select') THEN
    CREATE POLICY framework_mapping_tenant_select ON framework_mapping FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='framework_mapping' AND policyname='framework_mapping_tenant_insert') THEN
    CREATE POLICY framework_mapping_tenant_insert ON framework_mapping FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='framework_mapping' AND policyname='framework_mapping_tenant_update') THEN
    CREATE POLICY framework_mapping_tenant_update ON framework_mapping FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='framework_mapping' AND policyname='framework_mapping_tenant_delete') THEN
    CREATE POLICY framework_mapping_tenant_delete ON framework_mapping FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── general_catalog_entry ─────────────────────────────────────────────
ALTER TABLE IF EXISTS general_catalog_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS general_catalog_entry FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='general_catalog_entry' AND policyname='general_catalog_entry_tenant_select') THEN
    CREATE POLICY general_catalog_entry_tenant_select ON general_catalog_entry FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='general_catalog_entry' AND policyname='general_catalog_entry_tenant_insert') THEN
    CREATE POLICY general_catalog_entry_tenant_insert ON general_catalog_entry FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='general_catalog_entry' AND policyname='general_catalog_entry_tenant_update') THEN
    CREATE POLICY general_catalog_entry_tenant_update ON general_catalog_entry FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='general_catalog_entry' AND policyname='general_catalog_entry_tenant_delete') THEN
    CREATE POLICY general_catalog_entry_tenant_delete ON general_catalog_entry FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── invitation ─────────────────────────────────────────────
ALTER TABLE IF EXISTS invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invitation FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitation' AND policyname='invitation_tenant_select') THEN
    CREATE POLICY invitation_tenant_select ON invitation FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitation' AND policyname='invitation_tenant_insert') THEN
    CREATE POLICY invitation_tenant_insert ON invitation FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitation' AND policyname='invitation_tenant_update') THEN
    CREATE POLICY invitation_tenant_update ON invitation FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitation' AND policyname='invitation_tenant_delete') THEN
    CREATE POLICY invitation_tenant_delete ON invitation FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── lksg_assessment ─────────────────────────────────────────────
ALTER TABLE IF EXISTS lksg_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lksg_assessment FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lksg_assessment' AND policyname='lksg_assessment_tenant_select') THEN
    CREATE POLICY lksg_assessment_tenant_select ON lksg_assessment FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lksg_assessment' AND policyname='lksg_assessment_tenant_insert') THEN
    CREATE POLICY lksg_assessment_tenant_insert ON lksg_assessment FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lksg_assessment' AND policyname='lksg_assessment_tenant_update') THEN
    CREATE POLICY lksg_assessment_tenant_update ON lksg_assessment FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lksg_assessment' AND policyname='lksg_assessment_tenant_delete') THEN
    CREATE POLICY lksg_assessment_tenant_delete ON lksg_assessment FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── management_review ─────────────────────────────────────────────
ALTER TABLE IF EXISTS management_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS management_review FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='management_review' AND policyname='management_review_tenant_select') THEN
    CREATE POLICY management_review_tenant_select ON management_review FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='management_review' AND policyname='management_review_tenant_insert') THEN
    CREATE POLICY management_review_tenant_insert ON management_review FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='management_review' AND policyname='management_review_tenant_update') THEN
    CREATE POLICY management_review_tenant_update ON management_review FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='management_review' AND policyname='management_review_tenant_delete') THEN
    CREATE POLICY management_review_tenant_delete ON management_review FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── marketplace_category ─────────────────────────────────────────────
ALTER TABLE IF EXISTS marketplace_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketplace_category FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_category' AND policyname='marketplace_category_tenant_select') THEN
    CREATE POLICY marketplace_category_tenant_select ON marketplace_category FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_category' AND policyname='marketplace_category_tenant_insert') THEN
    CREATE POLICY marketplace_category_tenant_insert ON marketplace_category FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_category' AND policyname='marketplace_category_tenant_update') THEN
    CREATE POLICY marketplace_category_tenant_update ON marketplace_category FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_category' AND policyname='marketplace_category_tenant_delete') THEN
    CREATE POLICY marketplace_category_tenant_delete ON marketplace_category FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── module_config ─────────────────────────────────────────────
ALTER TABLE IF EXISTS module_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS module_config FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='module_config' AND policyname='module_config_tenant_select') THEN
    CREATE POLICY module_config_tenant_select ON module_config FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='module_config' AND policyname='module_config_tenant_insert') THEN
    CREATE POLICY module_config_tenant_insert ON module_config FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='module_config' AND policyname='module_config_tenant_update') THEN
    CREATE POLICY module_config_tenant_update ON module_config FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='module_config' AND policyname='module_config_tenant_delete') THEN
    CREATE POLICY module_config_tenant_delete ON module_config FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── onboarding_step ─────────────────────────────────────────────
ALTER TABLE IF EXISTS onboarding_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS onboarding_step FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='onboarding_step' AND policyname='onboarding_step_tenant_select') THEN
    CREATE POLICY onboarding_step_tenant_select ON onboarding_step FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='onboarding_step' AND policyname='onboarding_step_tenant_insert') THEN
    CREATE POLICY onboarding_step_tenant_insert ON onboarding_step FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='onboarding_step' AND policyname='onboarding_step_tenant_update') THEN
    CREATE POLICY onboarding_step_tenant_update ON onboarding_step FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='onboarding_step' AND policyname='onboarding_step_tenant_delete') THEN
    CREATE POLICY onboarding_step_tenant_delete ON onboarding_step FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── org_active_catalog ─────────────────────────────────────────────
ALTER TABLE IF EXISTS org_active_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS org_active_catalog FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_active_catalog' AND policyname='org_active_catalog_tenant_select') THEN
    CREATE POLICY org_active_catalog_tenant_select ON org_active_catalog FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_active_catalog' AND policyname='org_active_catalog_tenant_insert') THEN
    CREATE POLICY org_active_catalog_tenant_insert ON org_active_catalog FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_active_catalog' AND policyname='org_active_catalog_tenant_update') THEN
    CREATE POLICY org_active_catalog_tenant_update ON org_active_catalog FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_active_catalog' AND policyname='org_active_catalog_tenant_delete') THEN
    CREATE POLICY org_active_catalog_tenant_delete ON org_active_catalog FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── org_branding ─────────────────────────────────────────────
ALTER TABLE IF EXISTS org_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS org_branding FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_branding' AND policyname='org_branding_tenant_select') THEN
    CREATE POLICY org_branding_tenant_select ON org_branding FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_branding' AND policyname='org_branding_tenant_insert') THEN
    CREATE POLICY org_branding_tenant_insert ON org_branding FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_branding' AND policyname='org_branding_tenant_update') THEN
    CREATE POLICY org_branding_tenant_update ON org_branding FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_branding' AND policyname='org_branding_tenant_delete') THEN
    CREATE POLICY org_branding_tenant_delete ON org_branding FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── org_catalog_exclusion ─────────────────────────────────────────────
ALTER TABLE IF EXISTS org_catalog_exclusion ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS org_catalog_exclusion FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_catalog_exclusion' AND policyname='org_catalog_exclusion_tenant_select') THEN
    CREATE POLICY org_catalog_exclusion_tenant_select ON org_catalog_exclusion FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_catalog_exclusion' AND policyname='org_catalog_exclusion_tenant_insert') THEN
    CREATE POLICY org_catalog_exclusion_tenant_insert ON org_catalog_exclusion FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_catalog_exclusion' AND policyname='org_catalog_exclusion_tenant_update') THEN
    CREATE POLICY org_catalog_exclusion_tenant_update ON org_catalog_exclusion FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_catalog_exclusion' AND policyname='org_catalog_exclusion_tenant_delete') THEN
    CREATE POLICY org_catalog_exclusion_tenant_delete ON org_catalog_exclusion FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── org_risk_methodology ─────────────────────────────────────────────
ALTER TABLE IF EXISTS org_risk_methodology ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS org_risk_methodology FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_risk_methodology' AND policyname='org_risk_methodology_tenant_select') THEN
    CREATE POLICY org_risk_methodology_tenant_select ON org_risk_methodology FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_risk_methodology' AND policyname='org_risk_methodology_tenant_insert') THEN
    CREATE POLICY org_risk_methodology_tenant_insert ON org_risk_methodology FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_risk_methodology' AND policyname='org_risk_methodology_tenant_update') THEN
    CREATE POLICY org_risk_methodology_tenant_update ON org_risk_methodology FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='org_risk_methodology' AND policyname='org_risk_methodology_tenant_delete') THEN
    CREATE POLICY org_risk_methodology_tenant_delete ON org_risk_methodology FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── playbook_phase ─────────────────────────────────────────────
ALTER TABLE IF EXISTS playbook_phase ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS playbook_phase FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='playbook_phase' AND policyname='playbook_phase_tenant_select') THEN
    CREATE POLICY playbook_phase_tenant_select ON playbook_phase FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='playbook_phase' AND policyname='playbook_phase_tenant_insert') THEN
    CREATE POLICY playbook_phase_tenant_insert ON playbook_phase FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='playbook_phase' AND policyname='playbook_phase_tenant_update') THEN
    CREATE POLICY playbook_phase_tenant_update ON playbook_phase FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='playbook_phase' AND policyname='playbook_phase_tenant_delete') THEN
    CREATE POLICY playbook_phase_tenant_delete ON playbook_phase FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── playbook_task_template ─────────────────────────────────────────────
ALTER TABLE IF EXISTS playbook_task_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS playbook_task_template FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='playbook_task_template' AND policyname='playbook_task_template_tenant_select') THEN
    CREATE POLICY playbook_task_template_tenant_select ON playbook_task_template FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='playbook_task_template' AND policyname='playbook_task_template_tenant_insert') THEN
    CREATE POLICY playbook_task_template_tenant_insert ON playbook_task_template FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='playbook_task_template' AND policyname='playbook_task_template_tenant_update') THEN
    CREATE POLICY playbook_task_template_tenant_update ON playbook_task_template FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='playbook_task_template' AND policyname='playbook_task_template_tenant_delete') THEN
    CREATE POLICY playbook_task_template_tenant_delete ON playbook_task_template FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── plugin ─────────────────────────────────────────────
ALTER TABLE IF EXISTS plugin ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS plugin FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plugin' AND policyname='plugin_tenant_select') THEN
    CREATE POLICY plugin_tenant_select ON plugin FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plugin' AND policyname='plugin_tenant_insert') THEN
    CREATE POLICY plugin_tenant_insert ON plugin FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plugin' AND policyname='plugin_tenant_update') THEN
    CREATE POLICY plugin_tenant_update ON plugin FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plugin' AND policyname='plugin_tenant_delete') THEN
    CREATE POLICY plugin_tenant_delete ON plugin FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── plugin_hook ─────────────────────────────────────────────
ALTER TABLE IF EXISTS plugin_hook ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS plugin_hook FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plugin_hook' AND policyname='plugin_hook_tenant_select') THEN
    CREATE POLICY plugin_hook_tenant_select ON plugin_hook FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plugin_hook' AND policyname='plugin_hook_tenant_insert') THEN
    CREATE POLICY plugin_hook_tenant_insert ON plugin_hook FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plugin_hook' AND policyname='plugin_hook_tenant_update') THEN
    CREATE POLICY plugin_hook_tenant_update ON plugin_hook FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plugin_hook' AND policyname='plugin_hook_tenant_delete') THEN
    CREATE POLICY plugin_hook_tenant_delete ON plugin_hook FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process' AND policyname='process_tenant_select') THEN
    CREATE POLICY process_tenant_select ON process FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process' AND policyname='process_tenant_insert') THEN
    CREATE POLICY process_tenant_insert ON process FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process' AND policyname='process_tenant_update') THEN
    CREATE POLICY process_tenant_update ON process FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process' AND policyname='process_tenant_delete') THEN
    CREATE POLICY process_tenant_delete ON process FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_asset ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_asset FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_asset' AND policyname='process_asset_tenant_select') THEN
    CREATE POLICY process_asset_tenant_select ON process_asset FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_asset' AND policyname='process_asset_tenant_insert') THEN
    CREATE POLICY process_asset_tenant_insert ON process_asset FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_asset' AND policyname='process_asset_tenant_update') THEN
    CREATE POLICY process_asset_tenant_update ON process_asset FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_asset' AND policyname='process_asset_tenant_delete') THEN
    CREATE POLICY process_asset_tenant_delete ON process_asset FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_control ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_control FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_control' AND policyname='process_control_tenant_select') THEN
    CREATE POLICY process_control_tenant_select ON process_control FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_control' AND policyname='process_control_tenant_insert') THEN
    CREATE POLICY process_control_tenant_insert ON process_control FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_control' AND policyname='process_control_tenant_update') THEN
    CREATE POLICY process_control_tenant_update ON process_control FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_control' AND policyname='process_control_tenant_delete') THEN
    CREATE POLICY process_control_tenant_delete ON process_control FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_document ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_document FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_document' AND policyname='process_document_tenant_select') THEN
    CREATE POLICY process_document_tenant_select ON process_document FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_document' AND policyname='process_document_tenant_insert') THEN
    CREATE POLICY process_document_tenant_insert ON process_document FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_document' AND policyname='process_document_tenant_update') THEN
    CREATE POLICY process_document_tenant_update ON process_document FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_document' AND policyname='process_document_tenant_delete') THEN
    CREATE POLICY process_document_tenant_delete ON process_document FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_maturity_questionnaire ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_maturity_questionnaire ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_maturity_questionnaire FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_maturity_questionnaire' AND policyname='process_maturity_questionnaire_tenant_select') THEN
    CREATE POLICY process_maturity_questionnaire_tenant_select ON process_maturity_questionnaire FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_maturity_questionnaire' AND policyname='process_maturity_questionnaire_tenant_insert') THEN
    CREATE POLICY process_maturity_questionnaire_tenant_insert ON process_maturity_questionnaire FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_maturity_questionnaire' AND policyname='process_maturity_questionnaire_tenant_update') THEN
    CREATE POLICY process_maturity_questionnaire_tenant_update ON process_maturity_questionnaire FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_maturity_questionnaire' AND policyname='process_maturity_questionnaire_tenant_delete') THEN
    CREATE POLICY process_maturity_questionnaire_tenant_delete ON process_maturity_questionnaire FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_simulation_result ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_simulation_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_simulation_result FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_simulation_result' AND policyname='process_simulation_result_tenant_select') THEN
    CREATE POLICY process_simulation_result_tenant_select ON process_simulation_result FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_simulation_result' AND policyname='process_simulation_result_tenant_insert') THEN
    CREATE POLICY process_simulation_result_tenant_insert ON process_simulation_result FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_simulation_result' AND policyname='process_simulation_result_tenant_update') THEN
    CREATE POLICY process_simulation_result_tenant_update ON process_simulation_result FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_simulation_result' AND policyname='process_simulation_result_tenant_delete') THEN
    CREATE POLICY process_simulation_result_tenant_delete ON process_simulation_result FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_step ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_step FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step' AND policyname='process_step_tenant_select') THEN
    CREATE POLICY process_step_tenant_select ON process_step FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step' AND policyname='process_step_tenant_insert') THEN
    CREATE POLICY process_step_tenant_insert ON process_step FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step' AND policyname='process_step_tenant_update') THEN
    CREATE POLICY process_step_tenant_update ON process_step FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step' AND policyname='process_step_tenant_delete') THEN
    CREATE POLICY process_step_tenant_delete ON process_step FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_step_asset ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_step_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_step_asset FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step_asset' AND policyname='process_step_asset_tenant_select') THEN
    CREATE POLICY process_step_asset_tenant_select ON process_step_asset FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step_asset' AND policyname='process_step_asset_tenant_insert') THEN
    CREATE POLICY process_step_asset_tenant_insert ON process_step_asset FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step_asset' AND policyname='process_step_asset_tenant_update') THEN
    CREATE POLICY process_step_asset_tenant_update ON process_step_asset FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step_asset' AND policyname='process_step_asset_tenant_delete') THEN
    CREATE POLICY process_step_asset_tenant_delete ON process_step_asset FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_step_control ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_step_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_step_control FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step_control' AND policyname='process_step_control_tenant_select') THEN
    CREATE POLICY process_step_control_tenant_select ON process_step_control FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step_control' AND policyname='process_step_control_tenant_insert') THEN
    CREATE POLICY process_step_control_tenant_insert ON process_step_control FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step_control' AND policyname='process_step_control_tenant_update') THEN
    CREATE POLICY process_step_control_tenant_update ON process_step_control FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_step_control' AND policyname='process_step_control_tenant_delete') THEN
    CREATE POLICY process_step_control_tenant_delete ON process_step_control FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_template ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_template FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_template' AND policyname='process_template_tenant_select') THEN
    CREATE POLICY process_template_tenant_select ON process_template FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_template' AND policyname='process_template_tenant_insert') THEN
    CREATE POLICY process_template_tenant_insert ON process_template FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_template' AND policyname='process_template_tenant_update') THEN
    CREATE POLICY process_template_tenant_update ON process_template FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_template' AND policyname='process_template_tenant_delete') THEN
    CREATE POLICY process_template_tenant_delete ON process_template FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── process_version ─────────────────────────────────────────────
ALTER TABLE IF EXISTS process_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS process_version FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_version' AND policyname='process_version_tenant_select') THEN
    CREATE POLICY process_version_tenant_select ON process_version FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_version' AND policyname='process_version_tenant_insert') THEN
    CREATE POLICY process_version_tenant_insert ON process_version FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_version' AND policyname='process_version_tenant_update') THEN
    CREATE POLICY process_version_tenant_update ON process_version FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_version' AND policyname='process_version_tenant_delete') THEN
    CREATE POLICY process_version_tenant_delete ON process_version FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── programme_template ─────────────────────────────────────────────
ALTER TABLE IF EXISTS programme_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS programme_template FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template' AND policyname='programme_template_tenant_select') THEN
    CREATE POLICY programme_template_tenant_select ON programme_template FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template' AND policyname='programme_template_tenant_insert') THEN
    CREATE POLICY programme_template_tenant_insert ON programme_template FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template' AND policyname='programme_template_tenant_update') THEN
    CREATE POLICY programme_template_tenant_update ON programme_template FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template' AND policyname='programme_template_tenant_delete') THEN
    CREATE POLICY programme_template_tenant_delete ON programme_template FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── programme_template_phase ─────────────────────────────────────────────
ALTER TABLE IF EXISTS programme_template_phase ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS programme_template_phase FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_phase' AND policyname='programme_template_phase_tenant_select') THEN
    CREATE POLICY programme_template_phase_tenant_select ON programme_template_phase FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_phase' AND policyname='programme_template_phase_tenant_insert') THEN
    CREATE POLICY programme_template_phase_tenant_insert ON programme_template_phase FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_phase' AND policyname='programme_template_phase_tenant_update') THEN
    CREATE POLICY programme_template_phase_tenant_update ON programme_template_phase FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_phase' AND policyname='programme_template_phase_tenant_delete') THEN
    CREATE POLICY programme_template_phase_tenant_delete ON programme_template_phase FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── programme_template_step ─────────────────────────────────────────────
ALTER TABLE IF EXISTS programme_template_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS programme_template_step FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_step' AND policyname='programme_template_step_tenant_select') THEN
    CREATE POLICY programme_template_step_tenant_select ON programme_template_step FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_step' AND policyname='programme_template_step_tenant_insert') THEN
    CREATE POLICY programme_template_step_tenant_insert ON programme_template_step FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_step' AND policyname='programme_template_step_tenant_update') THEN
    CREATE POLICY programme_template_step_tenant_update ON programme_template_step FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_step' AND policyname='programme_template_step_tenant_delete') THEN
    CREATE POLICY programme_template_step_tenant_delete ON programme_template_step FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── programme_template_subtask ─────────────────────────────────────────────
ALTER TABLE IF EXISTS programme_template_subtask ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS programme_template_subtask FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_subtask' AND policyname='programme_template_subtask_tenant_select') THEN
    CREATE POLICY programme_template_subtask_tenant_select ON programme_template_subtask FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_subtask' AND policyname='programme_template_subtask_tenant_insert') THEN
    CREATE POLICY programme_template_subtask_tenant_insert ON programme_template_subtask FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_subtask' AND policyname='programme_template_subtask_tenant_update') THEN
    CREATE POLICY programme_template_subtask_tenant_update ON programme_template_subtask FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='programme_template_subtask' AND policyname='programme_template_subtask_tenant_delete') THEN
    CREATE POLICY programme_template_subtask_tenant_delete ON programme_template_subtask FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── questionnaire_question ─────────────────────────────────────────────
ALTER TABLE IF EXISTS questionnaire_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questionnaire_question FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_question' AND policyname='questionnaire_question_tenant_select') THEN
    CREATE POLICY questionnaire_question_tenant_select ON questionnaire_question FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_question' AND policyname='questionnaire_question_tenant_insert') THEN
    CREATE POLICY questionnaire_question_tenant_insert ON questionnaire_question FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_question' AND policyname='questionnaire_question_tenant_update') THEN
    CREATE POLICY questionnaire_question_tenant_update ON questionnaire_question FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_question' AND policyname='questionnaire_question_tenant_delete') THEN
    CREATE POLICY questionnaire_question_tenant_delete ON questionnaire_question FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── questionnaire_section ─────────────────────────────────────────────
ALTER TABLE IF EXISTS questionnaire_section ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questionnaire_section FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_section' AND policyname='questionnaire_section_tenant_select') THEN
    CREATE POLICY questionnaire_section_tenant_select ON questionnaire_section FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_section' AND policyname='questionnaire_section_tenant_insert') THEN
    CREATE POLICY questionnaire_section_tenant_insert ON questionnaire_section FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_section' AND policyname='questionnaire_section_tenant_update') THEN
    CREATE POLICY questionnaire_section_tenant_update ON questionnaire_section FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_section' AND policyname='questionnaire_section_tenant_delete') THEN
    CREATE POLICY questionnaire_section_tenant_delete ON questionnaire_section FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── questionnaire_template ─────────────────────────────────────────────
ALTER TABLE IF EXISTS questionnaire_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questionnaire_template FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_template' AND policyname='questionnaire_template_tenant_select') THEN
    CREATE POLICY questionnaire_template_tenant_select ON questionnaire_template FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_template' AND policyname='questionnaire_template_tenant_insert') THEN
    CREATE POLICY questionnaire_template_tenant_insert ON questionnaire_template FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_template' AND policyname='questionnaire_template_tenant_update') THEN
    CREATE POLICY questionnaire_template_tenant_update ON questionnaire_template FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaire_template' AND policyname='questionnaire_template_tenant_delete') THEN
    CREATE POLICY questionnaire_template_tenant_delete ON questionnaire_template FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── recovery_procedure_step ─────────────────────────────────────────────
ALTER TABLE IF EXISTS recovery_procedure_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recovery_procedure_step FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recovery_procedure_step' AND policyname='recovery_procedure_step_tenant_select') THEN
    CREATE POLICY recovery_procedure_step_tenant_select ON recovery_procedure_step FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recovery_procedure_step' AND policyname='recovery_procedure_step_tenant_insert') THEN
    CREATE POLICY recovery_procedure_step_tenant_insert ON recovery_procedure_step FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recovery_procedure_step' AND policyname='recovery_procedure_step_tenant_update') THEN
    CREATE POLICY recovery_procedure_step_tenant_update ON recovery_procedure_step FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recovery_procedure_step' AND policyname='recovery_procedure_step_tenant_delete') THEN
    CREATE POLICY recovery_procedure_step_tenant_delete ON recovery_procedure_step FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── regulatory_feed_item ─────────────────────────────────────────────
ALTER TABLE IF EXISTS regulatory_feed_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS regulatory_feed_item FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='regulatory_feed_item' AND policyname='regulatory_feed_item_tenant_select') THEN
    CREATE POLICY regulatory_feed_item_tenant_select ON regulatory_feed_item FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='regulatory_feed_item' AND policyname='regulatory_feed_item_tenant_insert') THEN
    CREATE POLICY regulatory_feed_item_tenant_insert ON regulatory_feed_item FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='regulatory_feed_item' AND policyname='regulatory_feed_item_tenant_update') THEN
    CREATE POLICY regulatory_feed_item_tenant_update ON regulatory_feed_item FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='regulatory_feed_item' AND policyname='regulatory_feed_item_tenant_delete') THEN
    CREATE POLICY regulatory_feed_item_tenant_delete ON regulatory_feed_item FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── risk_catalog ─────────────────────────────────────────────
ALTER TABLE IF EXISTS risk_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS risk_catalog FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='risk_catalog' AND policyname='risk_catalog_tenant_select') THEN
    CREATE POLICY risk_catalog_tenant_select ON risk_catalog FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='risk_catalog' AND policyname='risk_catalog_tenant_insert') THEN
    CREATE POLICY risk_catalog_tenant_insert ON risk_catalog FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='risk_catalog' AND policyname='risk_catalog_tenant_update') THEN
    CREATE POLICY risk_catalog_tenant_update ON risk_catalog FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='risk_catalog' AND policyname='risk_catalog_tenant_delete') THEN
    CREATE POLICY risk_catalog_tenant_delete ON risk_catalog FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── risk_catalog_entry ─────────────────────────────────────────────
ALTER TABLE IF EXISTS risk_catalog_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS risk_catalog_entry FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='risk_catalog_entry' AND policyname='risk_catalog_entry_tenant_select') THEN
    CREATE POLICY risk_catalog_entry_tenant_select ON risk_catalog_entry FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='risk_catalog_entry' AND policyname='risk_catalog_entry_tenant_insert') THEN
    CREATE POLICY risk_catalog_entry_tenant_insert ON risk_catalog_entry FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='risk_catalog_entry' AND policyname='risk_catalog_entry_tenant_update') THEN
    CREATE POLICY risk_catalog_entry_tenant_update ON risk_catalog_entry FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='risk_catalog_entry' AND policyname='risk_catalog_entry_tenant_delete') THEN
    CREATE POLICY risk_catalog_entry_tenant_delete ON risk_catalog_entry FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── role_permission ─────────────────────────────────────────────
ALTER TABLE IF EXISTS role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS role_permission FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_permission' AND policyname='role_permission_tenant_select') THEN
    CREATE POLICY role_permission_tenant_select ON role_permission FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_permission' AND policyname='role_permission_tenant_insert') THEN
    CREATE POLICY role_permission_tenant_insert ON role_permission FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_permission' AND policyname='role_permission_tenant_update') THEN
    CREATE POLICY role_permission_tenant_update ON role_permission FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_permission' AND policyname='role_permission_tenant_delete') THEN
    CREATE POLICY role_permission_tenant_delete ON role_permission FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ropa_data_category ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ropa_data_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ropa_data_category FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_data_category' AND policyname='ropa_data_category_tenant_select') THEN
    CREATE POLICY ropa_data_category_tenant_select ON ropa_data_category FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_data_category' AND policyname='ropa_data_category_tenant_insert') THEN
    CREATE POLICY ropa_data_category_tenant_insert ON ropa_data_category FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_data_category' AND policyname='ropa_data_category_tenant_update') THEN
    CREATE POLICY ropa_data_category_tenant_update ON ropa_data_category FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_data_category' AND policyname='ropa_data_category_tenant_delete') THEN
    CREATE POLICY ropa_data_category_tenant_delete ON ropa_data_category FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ropa_data_subject ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ropa_data_subject ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ropa_data_subject FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_data_subject' AND policyname='ropa_data_subject_tenant_select') THEN
    CREATE POLICY ropa_data_subject_tenant_select ON ropa_data_subject FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_data_subject' AND policyname='ropa_data_subject_tenant_insert') THEN
    CREATE POLICY ropa_data_subject_tenant_insert ON ropa_data_subject FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_data_subject' AND policyname='ropa_data_subject_tenant_update') THEN
    CREATE POLICY ropa_data_subject_tenant_update ON ropa_data_subject FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_data_subject' AND policyname='ropa_data_subject_tenant_delete') THEN
    CREATE POLICY ropa_data_subject_tenant_delete ON ropa_data_subject FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ropa_entry ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ropa_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ropa_entry FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_entry' AND policyname='ropa_entry_tenant_select') THEN
    CREATE POLICY ropa_entry_tenant_select ON ropa_entry FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_entry' AND policyname='ropa_entry_tenant_insert') THEN
    CREATE POLICY ropa_entry_tenant_insert ON ropa_entry FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_entry' AND policyname='ropa_entry_tenant_update') THEN
    CREATE POLICY ropa_entry_tenant_update ON ropa_entry FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_entry' AND policyname='ropa_entry_tenant_delete') THEN
    CREATE POLICY ropa_entry_tenant_delete ON ropa_entry FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── ropa_recipient ─────────────────────────────────────────────
ALTER TABLE IF EXISTS ropa_recipient ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ropa_recipient FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_recipient' AND policyname='ropa_recipient_tenant_select') THEN
    CREATE POLICY ropa_recipient_tenant_select ON ropa_recipient FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_recipient' AND policyname='ropa_recipient_tenant_insert') THEN
    CREATE POLICY ropa_recipient_tenant_insert ON ropa_recipient FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_recipient' AND policyname='ropa_recipient_tenant_update') THEN
    CREATE POLICY ropa_recipient_tenant_update ON ropa_recipient FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ropa_recipient' AND policyname='ropa_recipient_tenant_delete') THEN
    CREATE POLICY ropa_recipient_tenant_delete ON ropa_recipient FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── scenario_engine_scenario ─────────────────────────────────────────────
ALTER TABLE IF EXISTS scenario_engine_scenario ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scenario_engine_scenario FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scenario_engine_scenario' AND policyname='scenario_engine_scenario_tenant_select') THEN
    CREATE POLICY scenario_engine_scenario_tenant_select ON scenario_engine_scenario FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scenario_engine_scenario' AND policyname='scenario_engine_scenario_tenant_insert') THEN
    CREATE POLICY scenario_engine_scenario_tenant_insert ON scenario_engine_scenario FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scenario_engine_scenario' AND policyname='scenario_engine_scenario_tenant_update') THEN
    CREATE POLICY scenario_engine_scenario_tenant_update ON scenario_engine_scenario FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scenario_engine_scenario' AND policyname='scenario_engine_scenario_tenant_delete') THEN
    CREATE POLICY scenario_engine_scenario_tenant_delete ON scenario_engine_scenario FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── security_incident ─────────────────────────────────────────────
ALTER TABLE IF EXISTS security_incident ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS security_incident FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='security_incident' AND policyname='security_incident_tenant_select') THEN
    CREATE POLICY security_incident_tenant_select ON security_incident FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='security_incident' AND policyname='security_incident_tenant_insert') THEN
    CREATE POLICY security_incident_tenant_insert ON security_incident FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='security_incident' AND policyname='security_incident_tenant_update') THEN
    CREATE POLICY security_incident_tenant_update ON security_incident FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='security_incident' AND policyname='security_incident_tenant_delete') THEN
    CREATE POLICY security_incident_tenant_delete ON security_incident FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── session ─────────────────────────────────────────────
ALTER TABLE IF EXISTS session ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS session FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='session' AND policyname='session_tenant_select') THEN
    CREATE POLICY session_tenant_select ON session FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='session' AND policyname='session_tenant_insert') THEN
    CREATE POLICY session_tenant_insert ON session FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='session' AND policyname='session_tenant_update') THEN
    CREATE POLICY session_tenant_update ON session FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='session' AND policyname='session_tenant_delete') THEN
    CREATE POLICY session_tenant_delete ON session FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── simulation_run_result ─────────────────────────────────────────────
ALTER TABLE IF EXISTS simulation_run_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS simulation_run_result FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='simulation_run_result' AND policyname='simulation_run_result_tenant_select') THEN
    CREATE POLICY simulation_run_result_tenant_select ON simulation_run_result FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='simulation_run_result' AND policyname='simulation_run_result_tenant_insert') THEN
    CREATE POLICY simulation_run_result_tenant_insert ON simulation_run_result FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='simulation_run_result' AND policyname='simulation_run_result_tenant_update') THEN
    CREATE POLICY simulation_run_result_tenant_update ON simulation_run_result FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='simulation_run_result' AND policyname='simulation_run_result_tenant_delete') THEN
    CREATE POLICY simulation_run_result_tenant_delete ON simulation_run_result FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── soa_entry ─────────────────────────────────────────────
ALTER TABLE IF EXISTS soa_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS soa_entry FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soa_entry' AND policyname='soa_entry_tenant_select') THEN
    CREATE POLICY soa_entry_tenant_select ON soa_entry FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soa_entry' AND policyname='soa_entry_tenant_insert') THEN
    CREATE POLICY soa_entry_tenant_insert ON soa_entry FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soa_entry' AND policyname='soa_entry_tenant_update') THEN
    CREATE POLICY soa_entry_tenant_update ON soa_entry FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soa_entry' AND policyname='soa_entry_tenant_delete') THEN
    CREATE POLICY soa_entry_tenant_delete ON soa_entry FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── subscription_plan ─────────────────────────────────────────────
ALTER TABLE IF EXISTS subscription_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscription_plan FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscription_plan' AND policyname='subscription_plan_tenant_select') THEN
    CREATE POLICY subscription_plan_tenant_select ON subscription_plan FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscription_plan' AND policyname='subscription_plan_tenant_insert') THEN
    CREATE POLICY subscription_plan_tenant_insert ON subscription_plan FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscription_plan' AND policyname='subscription_plan_tenant_update') THEN
    CREATE POLICY subscription_plan_tenant_update ON subscription_plan FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscription_plan' AND policyname='subscription_plan_tenant_delete') THEN
    CREATE POLICY subscription_plan_tenant_delete ON subscription_plan FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── task ─────────────────────────────────────────────
ALTER TABLE IF EXISTS task ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS task FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task' AND policyname='task_tenant_select') THEN
    CREATE POLICY task_tenant_select ON task FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task' AND policyname='task_tenant_insert') THEN
    CREATE POLICY task_tenant_insert ON task FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task' AND policyname='task_tenant_update') THEN
    CREATE POLICY task_tenant_update ON task FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task' AND policyname='task_tenant_delete') THEN
    CREATE POLICY task_tenant_delete ON task FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── task_comment ─────────────────────────────────────────────
ALTER TABLE IF EXISTS task_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS task_comment FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_comment' AND policyname='task_comment_tenant_select') THEN
    CREATE POLICY task_comment_tenant_select ON task_comment FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_comment' AND policyname='task_comment_tenant_insert') THEN
    CREATE POLICY task_comment_tenant_insert ON task_comment FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_comment' AND policyname='task_comment_tenant_update') THEN
    CREATE POLICY task_comment_tenant_update ON task_comment FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_comment' AND policyname='task_comment_tenant_delete') THEN
    CREATE POLICY task_comment_tenant_delete ON task_comment FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── template_pack ─────────────────────────────────────────────
ALTER TABLE IF EXISTS template_pack ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS template_pack FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='template_pack' AND policyname='template_pack_tenant_select') THEN
    CREATE POLICY template_pack_tenant_select ON template_pack FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='template_pack' AND policyname='template_pack_tenant_insert') THEN
    CREATE POLICY template_pack_tenant_insert ON template_pack FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='template_pack' AND policyname='template_pack_tenant_update') THEN
    CREATE POLICY template_pack_tenant_update ON template_pack FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='template_pack' AND policyname='template_pack_tenant_delete') THEN
    CREATE POLICY template_pack_tenant_delete ON template_pack FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── template_pack_item ─────────────────────────────────────────────
ALTER TABLE IF EXISTS template_pack_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS template_pack_item FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='template_pack_item' AND policyname='template_pack_item_tenant_select') THEN
    CREATE POLICY template_pack_item_tenant_select ON template_pack_item FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='template_pack_item' AND policyname='template_pack_item_tenant_insert') THEN
    CREATE POLICY template_pack_item_tenant_insert ON template_pack_item FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='template_pack_item' AND policyname='template_pack_item_tenant_update') THEN
    CREATE POLICY template_pack_item_tenant_update ON template_pack_item FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='template_pack_item' AND policyname='template_pack_item_tenant_delete') THEN
    CREATE POLICY template_pack_item_tenant_delete ON template_pack_item FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── threat ─────────────────────────────────────────────
ALTER TABLE IF EXISTS threat ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS threat FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='threat' AND policyname='threat_tenant_select') THEN
    CREATE POLICY threat_tenant_select ON threat FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='threat' AND policyname='threat_tenant_insert') THEN
    CREATE POLICY threat_tenant_insert ON threat FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='threat' AND policyname='threat_tenant_update') THEN
    CREATE POLICY threat_tenant_update ON threat FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='threat' AND policyname='threat_tenant_delete') THEN
    CREATE POLICY threat_tenant_delete ON threat FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── tia ─────────────────────────────────────────────
ALTER TABLE IF EXISTS tia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tia FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tia' AND policyname='tia_tenant_select') THEN
    CREATE POLICY tia_tenant_select ON tia FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tia' AND policyname='tia_tenant_insert') THEN
    CREATE POLICY tia_tenant_insert ON tia FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tia' AND policyname='tia_tenant_update') THEN
    CREATE POLICY tia_tenant_update ON tia FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tia' AND policyname='tia_tenant_delete') THEN
    CREATE POLICY tia_tenant_delete ON tia FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── usage_meter ─────────────────────────────────────────────
ALTER TABLE IF EXISTS usage_meter ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_meter FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='usage_meter' AND policyname='usage_meter_tenant_select') THEN
    CREATE POLICY usage_meter_tenant_select ON usage_meter FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='usage_meter' AND policyname='usage_meter_tenant_insert') THEN
    CREATE POLICY usage_meter_tenant_insert ON usage_meter FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='usage_meter' AND policyname='usage_meter_tenant_update') THEN
    CREATE POLICY usage_meter_tenant_update ON usage_meter FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='usage_meter' AND policyname='usage_meter_tenant_delete') THEN
    CREATE POLICY usage_meter_tenant_delete ON usage_meter FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── user_dashboard_layout ─────────────────────────────────────────────
ALTER TABLE IF EXISTS user_dashboard_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_dashboard_layout FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_dashboard_layout' AND policyname='user_dashboard_layout_tenant_select') THEN
    CREATE POLICY user_dashboard_layout_tenant_select ON user_dashboard_layout FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_dashboard_layout' AND policyname='user_dashboard_layout_tenant_insert') THEN
    CREATE POLICY user_dashboard_layout_tenant_insert ON user_dashboard_layout FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_dashboard_layout' AND policyname='user_dashboard_layout_tenant_update') THEN
    CREATE POLICY user_dashboard_layout_tenant_update ON user_dashboard_layout FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_dashboard_layout' AND policyname='user_dashboard_layout_tenant_delete') THEN
    CREATE POLICY user_dashboard_layout_tenant_delete ON user_dashboard_layout FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── vendor ─────────────────────────────────────────────
ALTER TABLE IF EXISTS vendor ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor' AND policyname='vendor_tenant_select') THEN
    CREATE POLICY vendor_tenant_select ON vendor FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor' AND policyname='vendor_tenant_insert') THEN
    CREATE POLICY vendor_tenant_insert ON vendor FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor' AND policyname='vendor_tenant_update') THEN
    CREATE POLICY vendor_tenant_update ON vendor FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor' AND policyname='vendor_tenant_delete') THEN
    CREATE POLICY vendor_tenant_delete ON vendor FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── vendor_contact ─────────────────────────────────────────────
ALTER TABLE IF EXISTS vendor_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_contact FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_contact' AND policyname='vendor_contact_tenant_select') THEN
    CREATE POLICY vendor_contact_tenant_select ON vendor_contact FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_contact' AND policyname='vendor_contact_tenant_insert') THEN
    CREATE POLICY vendor_contact_tenant_insert ON vendor_contact FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_contact' AND policyname='vendor_contact_tenant_update') THEN
    CREATE POLICY vendor_contact_tenant_update ON vendor_contact FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_contact' AND policyname='vendor_contact_tenant_delete') THEN
    CREATE POLICY vendor_contact_tenant_delete ON vendor_contact FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── vendor_due_diligence ─────────────────────────────────────────────
ALTER TABLE IF EXISTS vendor_due_diligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_due_diligence FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_due_diligence' AND policyname='vendor_due_diligence_tenant_select') THEN
    CREATE POLICY vendor_due_diligence_tenant_select ON vendor_due_diligence FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_due_diligence' AND policyname='vendor_due_diligence_tenant_insert') THEN
    CREATE POLICY vendor_due_diligence_tenant_insert ON vendor_due_diligence FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_due_diligence' AND policyname='vendor_due_diligence_tenant_update') THEN
    CREATE POLICY vendor_due_diligence_tenant_update ON vendor_due_diligence FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_due_diligence' AND policyname='vendor_due_diligence_tenant_delete') THEN
    CREATE POLICY vendor_due_diligence_tenant_delete ON vendor_due_diligence FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── vendor_due_diligence_question ─────────────────────────────────────────────
ALTER TABLE IF EXISTS vendor_due_diligence_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_due_diligence_question FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_due_diligence_question' AND policyname='vendor_due_diligence_question_tenant_select') THEN
    CREATE POLICY vendor_due_diligence_question_tenant_select ON vendor_due_diligence_question FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_due_diligence_question' AND policyname='vendor_due_diligence_question_tenant_insert') THEN
    CREATE POLICY vendor_due_diligence_question_tenant_insert ON vendor_due_diligence_question FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_due_diligence_question' AND policyname='vendor_due_diligence_question_tenant_update') THEN
    CREATE POLICY vendor_due_diligence_question_tenant_update ON vendor_due_diligence_question FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_due_diligence_question' AND policyname='vendor_due_diligence_question_tenant_delete') THEN
    CREATE POLICY vendor_due_diligence_question_tenant_delete ON vendor_due_diligence_question FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── vendor_risk_assessment ─────────────────────────────────────────────
ALTER TABLE IF EXISTS vendor_risk_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_risk_assessment FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_risk_assessment' AND policyname='vendor_risk_assessment_tenant_select') THEN
    CREATE POLICY vendor_risk_assessment_tenant_select ON vendor_risk_assessment FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_risk_assessment' AND policyname='vendor_risk_assessment_tenant_insert') THEN
    CREATE POLICY vendor_risk_assessment_tenant_insert ON vendor_risk_assessment FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_risk_assessment' AND policyname='vendor_risk_assessment_tenant_update') THEN
    CREATE POLICY vendor_risk_assessment_tenant_update ON vendor_risk_assessment FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_risk_assessment' AND policyname='vendor_risk_assessment_tenant_delete') THEN
    CREATE POLICY vendor_risk_assessment_tenant_delete ON vendor_risk_assessment FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── verification_token ─────────────────────────────────────────────
ALTER TABLE IF EXISTS verification_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verification_token FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='verification_token' AND policyname='verification_token_tenant_select') THEN
    CREATE POLICY verification_token_tenant_select ON verification_token FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='verification_token' AND policyname='verification_token_tenant_insert') THEN
    CREATE POLICY verification_token_tenant_insert ON verification_token FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='verification_token' AND policyname='verification_token_tenant_update') THEN
    CREATE POLICY verification_token_tenant_update ON verification_token FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='verification_token' AND policyname='verification_token_tenant_delete') THEN
    CREATE POLICY verification_token_tenant_delete ON verification_token FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── vulnerability ─────────────────────────────────────────────
ALTER TABLE IF EXISTS vulnerability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vulnerability FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vulnerability' AND policyname='vulnerability_tenant_select') THEN
    CREATE POLICY vulnerability_tenant_select ON vulnerability FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vulnerability' AND policyname='vulnerability_tenant_insert') THEN
    CREATE POLICY vulnerability_tenant_insert ON vulnerability FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vulnerability' AND policyname='vulnerability_tenant_update') THEN
    CREATE POLICY vulnerability_tenant_update ON vulnerability FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vulnerability' AND policyname='vulnerability_tenant_delete') THEN
    CREATE POLICY vulnerability_tenant_delete ON vulnerability FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── wb_anonymous_mailbox ─────────────────────────────────────────────
ALTER TABLE IF EXISTS wb_anonymous_mailbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wb_anonymous_mailbox FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_anonymous_mailbox' AND policyname='wb_anonymous_mailbox_tenant_select') THEN
    CREATE POLICY wb_anonymous_mailbox_tenant_select ON wb_anonymous_mailbox FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_anonymous_mailbox' AND policyname='wb_anonymous_mailbox_tenant_insert') THEN
    CREATE POLICY wb_anonymous_mailbox_tenant_insert ON wb_anonymous_mailbox FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_anonymous_mailbox' AND policyname='wb_anonymous_mailbox_tenant_update') THEN
    CREATE POLICY wb_anonymous_mailbox_tenant_update ON wb_anonymous_mailbox FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_anonymous_mailbox' AND policyname='wb_anonymous_mailbox_tenant_delete') THEN
    CREATE POLICY wb_anonymous_mailbox_tenant_delete ON wb_anonymous_mailbox FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── wb_case ─────────────────────────────────────────────
ALTER TABLE IF EXISTS wb_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wb_case FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case' AND policyname='wb_case_tenant_select') THEN
    CREATE POLICY wb_case_tenant_select ON wb_case FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case' AND policyname='wb_case_tenant_insert') THEN
    CREATE POLICY wb_case_tenant_insert ON wb_case FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case' AND policyname='wb_case_tenant_update') THEN
    CREATE POLICY wb_case_tenant_update ON wb_case FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case' AND policyname='wb_case_tenant_delete') THEN
    CREATE POLICY wb_case_tenant_delete ON wb_case FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── wb_case_evidence ─────────────────────────────────────────────
ALTER TABLE IF EXISTS wb_case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wb_case_evidence FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case_evidence' AND policyname='wb_case_evidence_tenant_select') THEN
    CREATE POLICY wb_case_evidence_tenant_select ON wb_case_evidence FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case_evidence' AND policyname='wb_case_evidence_tenant_insert') THEN
    CREATE POLICY wb_case_evidence_tenant_insert ON wb_case_evidence FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case_evidence' AND policyname='wb_case_evidence_tenant_update') THEN
    CREATE POLICY wb_case_evidence_tenant_update ON wb_case_evidence FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case_evidence' AND policyname='wb_case_evidence_tenant_delete') THEN
    CREATE POLICY wb_case_evidence_tenant_delete ON wb_case_evidence FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── wb_case_message ─────────────────────────────────────────────
ALTER TABLE IF EXISTS wb_case_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wb_case_message FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case_message' AND policyname='wb_case_message_tenant_select') THEN
    CREATE POLICY wb_case_message_tenant_select ON wb_case_message FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case_message' AND policyname='wb_case_message_tenant_insert') THEN
    CREATE POLICY wb_case_message_tenant_insert ON wb_case_message FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case_message' AND policyname='wb_case_message_tenant_update') THEN
    CREATE POLICY wb_case_message_tenant_update ON wb_case_message FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_case_message' AND policyname='wb_case_message_tenant_delete') THEN
    CREATE POLICY wb_case_message_tenant_delete ON wb_case_message FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── wb_report ─────────────────────────────────────────────
ALTER TABLE IF EXISTS wb_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wb_report FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_report' AND policyname='wb_report_tenant_select') THEN
    CREATE POLICY wb_report_tenant_select ON wb_report FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_report' AND policyname='wb_report_tenant_insert') THEN
    CREATE POLICY wb_report_tenant_insert ON wb_report FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_report' AND policyname='wb_report_tenant_update') THEN
    CREATE POLICY wb_report_tenant_update ON wb_report FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wb_report' AND policyname='wb_report_tenant_delete') THEN
    CREATE POLICY wb_report_tenant_delete ON wb_report FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── widget_definition ─────────────────────────────────────────────
ALTER TABLE IF EXISTS widget_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS widget_definition FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='widget_definition' AND policyname='widget_definition_tenant_select') THEN
    CREATE POLICY widget_definition_tenant_select ON widget_definition FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='widget_definition' AND policyname='widget_definition_tenant_insert') THEN
    CREATE POLICY widget_definition_tenant_insert ON widget_definition FOR INSERT WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='widget_definition' AND policyname='widget_definition_tenant_update') THEN
    CREATE POLICY widget_definition_tenant_update ON widget_definition FOR UPDATE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='widget_definition' AND policyname='widget_definition_tenant_delete') THEN
    CREATE POLICY widget_definition_tenant_delete ON widget_definition FOR DELETE USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

COMMIT;
