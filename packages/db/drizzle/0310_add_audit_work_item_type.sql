-- 0310: Register `audit` as a work_item_type.
--
-- The audit_auto_create_work_item trigger (migration 0017,
-- packages/db/drizzle/0017_sprint8_audit_mgmt.sql:5) inserts
-- a work_item with type_key='audit' on every audit INSERT, but
-- the original 0005 seed only ships 'audit_finding' and 'audit_action'
-- (no plain 'audit'). The FK on work_item.type_key →
-- work_item_type.type_key consequently failed and the
-- packages/db/tests/rls/audit-checklist-isolation.test.ts integration
-- test 500'd at the very first INSERT INTO audit (...) — which
-- masqueraded as an RLS regression in CI but was really a
-- plain missing-seed bug.
--
-- Same shape as risk_treatment in migration 0301 (idempotent via
-- ON CONFLICT). nav_order keeps it grouped with audit_finding/action
-- in the audit module's nav.

INSERT INTO work_item_type (
  type_key, display_name_de, display_name_en, icon, color_class,
  primary_module, secondary_modules, has_status_workflow, has_responsible_user,
  has_due_date, has_priority, has_linked_asset, has_cia_evaluation,
  is_cross_module, status_enum_name, data_table, data_fk_column,
  element_id_prefix, nav_order, is_active_in_platform
) VALUES
  ('audit', 'Audit', 'Audit', 'ClipboardCheck', 'text-amber-700',
   'audit', '{}', true, true, true, true, false, false,
   false, NULL, 'audit', 'work_item_id', 'AUD', 2, true)
ON CONFLICT (type_key) DO NOTHING;
