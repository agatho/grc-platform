-- Migration 0349: enable RLS on catalog_entry_reference.
--
-- #SEC-RLS-GAP: post-Wave-25 RBAC/RLS audit
-- (docs/audits/rbac-rls-audit-2026-05-22.md §"RLS gaps") identified
-- catalog_entry_reference as the single org-scoped table created by
-- migration 0012 that ships customer cross-framework mapping data
-- (`org_id` FK to organization, INSERTs from
-- /api/v1/catalogs/mappings/route.ts) yet had no
-- `ENABLE ROW LEVEL SECURITY` and no policy anywhere across the 348
-- migrations.
--
-- Result: pre-Wave-26, any authenticated request that constructed a
-- SELECT against catalog_entry_reference would see rows for every
-- tenant, breaking the multi-entity isolation guarantee documented in
-- ADR-001. (The risk was bounded — almost all access goes through
-- application code that filters by org_id explicitly — but the defence
-- in depth was missing and would have failed an external audit on a
-- read of the schema.)
--
-- This migration:
--   1. ENABLE ROW LEVEL SECURITY
--   2. FORCE ROW LEVEL SECURITY (so the table owner doesn't bypass)
--   3. Four standard policies: SELECT / INSERT / UPDATE / DELETE
--      keyed on current_setting('app.current_org_id')::uuid
--   4. Re-runs cleanly if applied twice (DROP POLICY IF EXISTS first)
--
-- Acceptance test (manual on staging):
--   SET app.current_org_id = '<org_a_uuid>';
--   SELECT count(*) FROM catalog_entry_reference;  -- only org_a rows
--   SET app.current_org_id = '<org_b_uuid>';
--   SELECT count(*) FROM catalog_entry_reference;  -- only org_b rows
--
-- After Wave 26 ships the RLS-baseline test will pick up this new
-- enforcement — current baseline is 142, after this migration it will
-- be 143. Memory note: the baseline is a security boundary and must
-- never be lowered.

BEGIN;

-- Defensive drops so re-applying the migration on an already-policied
-- table works.
DROP POLICY IF EXISTS catalog_entry_reference_tenant_select
  ON catalog_entry_reference;
DROP POLICY IF EXISTS catalog_entry_reference_tenant_insert
  ON catalog_entry_reference;
DROP POLICY IF EXISTS catalog_entry_reference_tenant_update
  ON catalog_entry_reference;
DROP POLICY IF EXISTS catalog_entry_reference_tenant_delete
  ON catalog_entry_reference;

ALTER TABLE catalog_entry_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_entry_reference FORCE ROW LEVEL SECURITY;

CREATE POLICY catalog_entry_reference_tenant_select
  ON catalog_entry_reference
  FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY catalog_entry_reference_tenant_insert
  ON catalog_entry_reference
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY catalog_entry_reference_tenant_update
  ON catalog_entry_reference
  FOR UPDATE
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY catalog_entry_reference_tenant_delete
  ON catalog_entry_reference
  FOR DELETE
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

COMMIT;
