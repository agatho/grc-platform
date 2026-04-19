-- ============================================================================
-- Migration 0106: Bridge catalog_entry_mapping → framework_mapping
--
-- Problem: Two parallel mapping tables existed:
--   - catalog_entry_mapping (UUID-based, populated by 401+ seed mappings)
--   - framework_mapping     (string-coded, used by Framework-Mappings API)
-- These never synced, so the API surface saw 0 of the seeded mappings.
--
-- Fix: This migration backfills framework_mapping from catalog_entry_mapping.
--   - Maps catalog.source → framework string identifier
--   - Maps relationship enum (equivalent/partial_overlap/subset/superset/related)
--     to API enum (equal/intersect/subset/superset/not_related)
--   - Confidence integer (0-100) → numeric (0.00-1.00)
--   - Marks rows as built-in & verified (since they come from official seeds)
--
-- Idempotent: ON CONFLICT DO NOTHING (uses fm_unique_mapping_idx).
-- Safe to re-run after adding new catalog_entry_mapping rows.
-- ============================================================================

INSERT INTO framework_mapping (
  source_framework, source_control_id, source_control_title,
  target_framework, target_control_id, target_control_title,
  relationship_type, confidence,
  mapping_source, rationale,
  is_verified, is_built_in
)
SELECT
  src_cat.source                             AS source_framework,
  src_entry.code                             AS source_control_id,
  COALESCE(src_entry.name_de, src_entry.name) AS source_control_title,
  tgt_cat.source                             AS target_framework,
  tgt_entry.code                             AS target_control_id,
  COALESCE(tgt_entry.name_de, tgt_entry.name) AS target_control_title,
  CASE cem.relationship::text
    WHEN 'equivalent'      THEN 'equal'
    WHEN 'partial_overlap' THEN 'intersect'
    WHEN 'partial'         THEN 'intersect'
    WHEN 'subset'          THEN 'subset'
    WHEN 'superset'        THEN 'superset'
    WHEN 'contained_by'    THEN 'subset'
    WHEN 'contains'        THEN 'superset'
    WHEN 'related'         THEN 'intersect'
    ELSE 'intersect'
  END                                        AS relationship_type,
  ROUND((cem.confidence::numeric / 100.0), 2) AS confidence,
  CASE cem.mapping_source::text
    WHEN 'official'     THEN 'nist_olir'
    WHEN 'nist_olir'    THEN 'nist_olir'
    WHEN 'community'    THEN 'manual'
    WHEN 'manual'       THEN 'manual'
    WHEN 'ai_suggested' THEN 'ai_suggested'
    ELSE 'nist_olir'
  END                                        AS mapping_source,
  CONCAT('Backfilled from catalog_entry_mapping. Source: ', COALESCE(cem.source_reference, 'NIST OLIR / official')) AS rationale,
  TRUE                                       AS is_verified,
  TRUE                                       AS is_built_in
FROM catalog_entry_mapping cem
JOIN catalog_entry src_entry ON src_entry.id = cem.source_entry_id
JOIN catalog_entry tgt_entry ON tgt_entry.id = cem.target_entry_id
JOIN catalog       src_cat   ON src_cat.id   = src_entry.catalog_id
JOIN catalog       tgt_cat   ON tgt_cat.id   = tgt_entry.catalog_id
ON CONFLICT (source_framework, source_control_id, target_framework, target_control_id)
DO NOTHING;

-- ============================================================================
-- Helper view: framework_mapping_full
-- Joins framework_mapping with current catalog_entry titles so dashboards can
-- always show fresh, translated titles instead of the snapshot at backfill
-- time. Use this view for read-side queries instead of joining manually.
-- ============================================================================

CREATE OR REPLACE VIEW framework_mapping_full AS
SELECT
  fm.id,
  fm.source_framework,
  fm.source_control_id,
  COALESCE(src_e.name_de, src_e.name, fm.source_control_title) AS source_control_title,
  fm.target_framework,
  fm.target_control_id,
  COALESCE(tgt_e.name_de, tgt_e.name, fm.target_control_title) AS target_control_title,
  fm.relationship_type,
  fm.confidence,
  fm.mapping_source,
  fm.rationale,
  fm.is_verified,
  fm.is_built_in,
  fm.metadata,
  fm.created_at,
  fm.updated_at,
  src_e.id AS source_catalog_entry_id,
  tgt_e.id AS target_catalog_entry_id
FROM framework_mapping fm
LEFT JOIN catalog src_c ON src_c.source = fm.source_framework
LEFT JOIN catalog_entry src_e ON src_e.catalog_id = src_c.id AND src_e.code = fm.source_control_id
LEFT JOIN catalog tgt_c ON tgt_c.source = fm.target_framework
LEFT JOIN catalog_entry tgt_e ON tgt_e.catalog_id = tgt_c.id AND tgt_e.code = fm.target_control_id;

COMMENT ON VIEW framework_mapping_full IS
  'Read-side view that joins framework_mapping with live catalog_entry titles. '
  'Use this when displaying mappings to keep titles synchronised with catalog updates.';
