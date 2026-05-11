-- 0301: Register `risk_treatment` as a work_item_type.
--
-- The POST /api/v1/risks/{id}/treatments handler creates a work_item
-- with typeKey "risk_treatment" alongside the riskTreatment row, but
-- no seed ever inserted that type into work_item_type, so the FK
-- constraint failed and the route 500'd with an empty body on every
-- treatment-create attempt — making it impossible to advance any risk
-- past the "assessed" status (the state-machine pre-condition for
-- "treated" requires at least one active treatment). QA-017 in
-- docs/qa-reports/arctos-qa-verification-2026-05-11-wave2.md.
--
-- Idempotent (ON CONFLICT DO NOTHING) so it's safe on fresh installs
-- and re-runs.

INSERT INTO work_item_type (
  type_key, display_name_de, display_name_en, icon, color_class,
  primary_module, secondary_modules, has_status_workflow, has_responsible_user,
  has_due_date, has_priority, has_linked_asset, has_cia_evaluation,
  is_cross_module, status_enum_name, data_table, data_fk_column,
  element_id_prefix, nav_order, is_active_in_platform
) VALUES
  ('risk_treatment', 'Risikobehandlung', 'Risk Treatment', 'Wrench', 'text-blue-700',
   'erm', '{}', true, true, true, true, false, false,
   false, 'treatment_status', 'risk_treatment', 'work_item_id', 'TRT', 11, true)
ON CONFLICT (type_key) DO NOTHING;
