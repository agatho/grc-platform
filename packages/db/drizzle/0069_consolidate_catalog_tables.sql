-- Migration 0069: Consolidate typed catalog tables into generic catalog + catalog_entry
-- Adds bilingual columns to catalog_entry, copies data from typed tables, creates views.
-- Does NOT drop old tables (backward compatibility).

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. Add bilingual columns to catalog_entry
-- ──────────────────────────────────────────────────────────────

ALTER TABLE catalog_entry
  ADD COLUMN IF NOT EXISTS name_de varchar(500),
  ADD COLUMN IF NOT EXISTS description_de text;

COMMENT ON COLUMN catalog_entry.name_de IS 'German name/title (name column stores English)';
COMMENT ON COLUMN catalog_entry.description_de IS 'German description (description column stores English)';

-- ──────────────────────────────────────────────────────────────
-- 2. Copy risk_catalog -> catalog (if not already present by source)
-- ──────────────────────────────────────────────────────────────

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules, created_at, updated_at)
SELECT
  rc.id,
  rc.name,
  rc.description,
  'risk',
  'platform',
  rc.source,
  rc.version,
  rc.language,
  rc.is_active,
  rc.target_modules,
  rc.created_at,
  rc.updated_at
FROM risk_catalog rc
WHERE NOT EXISTS (
  SELECT 1 FROM catalog c WHERE c.source = rc.source
)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 3. Copy control_catalog -> catalog (if not already present by source)
-- ──────────────────────────────────────────────────────────────

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules, created_at, updated_at)
SELECT
  cc.id,
  cc.name,
  cc.description,
  'control',
  'platform',
  cc.source,
  cc.version,
  cc.language,
  cc.is_active,
  cc.target_modules,
  cc.created_at,
  cc.updated_at
FROM control_catalog cc
WHERE NOT EXISTS (
  SELECT 1 FROM catalog c WHERE c.source = cc.source
)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 4. Copy risk_catalog_entry -> catalog_entry
--    Match catalog_id by looking up source in generic catalog table
-- ──────────────────────────────────────────────────────────────

INSERT INTO catalog_entry (id, catalog_id, parent_entry_id, code, name, name_de, description, description_de, level, sort_order, status, metadata, created_at)
SELECT
  rce.id,
  c.id,  -- generic catalog id (matched by source)
  NULL,  -- parent_entry_id will be fixed up below
  rce.code,
  COALESCE(rce.title_en, rce.title_de),
  rce.title_de,
  rce.description_en,
  rce.description_de,
  rce.level,
  rce.sort_order,
  CASE WHEN rce.is_active THEN 'active' ELSE 'inactive' END,
  jsonb_build_object(
    'risk_category', rce.risk_category,
    'default_likelihood', rce.default_likelihood,
    'default_impact', rce.default_impact,
    'source_table', 'risk_catalog_entry'
  ),
  rce.created_at
FROM risk_catalog_entry rce
JOIN risk_catalog rc ON rc.id = rce.catalog_id
JOIN catalog c ON c.source = rc.source
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_entry ce WHERE ce.catalog_id = c.id AND ce.code = rce.code
)
ON CONFLICT DO NOTHING;

-- Fix parent_entry_id references for risk entries
UPDATE catalog_entry ce
SET parent_entry_id = (
  SELECT ce_parent.id
  FROM risk_catalog_entry rce
  JOIN risk_catalog_entry rce_parent ON rce_parent.id = rce.parent_entry_id
  JOIN catalog_entry ce_parent ON ce_parent.code = rce_parent.code
    AND ce_parent.catalog_id = ce.catalog_id
  WHERE rce.id = ce.id
)
FROM risk_catalog_entry rce
WHERE rce.id = ce.id
  AND rce.parent_entry_id IS NOT NULL
  AND ce.parent_entry_id IS NULL
  AND (ce.metadata->>'source_table') = 'risk_catalog_entry';

-- ──────────────────────────────────────────────────────────────
-- 5. Copy control_catalog_entry -> catalog_entry
-- ──────────────────────────────────────────────────────────────

INSERT INTO catalog_entry (id, catalog_id, parent_entry_id, code, name, name_de, description, description_de, level, sort_order, status, metadata, created_at)
SELECT
  cce.id,
  c.id,
  NULL,  -- parent_entry_id will be fixed up below
  cce.code,
  COALESCE(cce.title_en, cce.title_de),
  cce.title_de,
  cce.description_en,
  cce.description_de,
  cce.level,
  cce.sort_order,
  CASE WHEN cce.is_active THEN 'active' ELSE 'inactive' END,
  jsonb_build_object(
    'control_type', cce.control_type_cat,
    'default_frequency', cce.default_frequency,
    'implementation_de', cce.implementation_de,
    'implementation_en', cce.implementation_en,
    'source_table', 'control_catalog_entry'
  ),
  cce.created_at
FROM control_catalog_entry cce
JOIN control_catalog cc ON cc.id = cce.catalog_id
JOIN catalog c ON c.source = cc.source
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_entry ce WHERE ce.catalog_id = c.id AND ce.code = cce.code
)
ON CONFLICT DO NOTHING;

-- Fix parent_entry_id references for control entries
UPDATE catalog_entry ce
SET parent_entry_id = (
  SELECT ce_parent.id
  FROM control_catalog_entry cce
  JOIN control_catalog_entry cce_parent ON cce_parent.id = cce.parent_entry_id
  JOIN catalog_entry ce_parent ON ce_parent.code = cce_parent.code
    AND ce_parent.catalog_id = ce.catalog_id
  WHERE cce.id = ce.id
)
FROM control_catalog_entry cce
WHERE cce.id = ce.id
  AND cce.parent_entry_id IS NOT NULL
  AND ce.parent_entry_id IS NULL
  AND (ce.metadata->>'source_table') = 'control_catalog_entry';

-- ──────────────────────────────────────────────────────────────
-- 5b. Backfill German names from typed tables into existing generic entries
--     (for entries that existed in both typed and generic by matching code+source)
-- ──────────────────────────────────────────────────────────────

UPDATE catalog_entry ce
SET name_de = cce.title_de,
    description_de = COALESCE(cce.description_de, ce.description_de)
FROM control_catalog_entry cce
JOIN control_catalog cc ON cc.id = cce.catalog_id
JOIN catalog c ON c.source = cc.source
WHERE ce.catalog_id = c.id
  AND ce.code = cce.code
  AND cce.title_de IS NOT NULL;

UPDATE catalog_entry ce
SET name_de = rce.title_de,
    description_de = COALESCE(rce.description_de, ce.description_de)
FROM risk_catalog_entry rce
JOIN risk_catalog rc ON rc.id = rce.catalog_id
JOIN catalog c ON c.source = rc.source
WHERE ce.catalog_id = c.id
  AND ce.code = rce.code
  AND rce.title_de IS NOT NULL
  AND ce.name_de = ce.name;  -- only update if not already set by the INSERT

-- ──────────────────────────────────────────────────────────────
-- 6. Backfill name_de for existing generic catalog entries that
--    already had data (from SQL seed files). These use name=EN.
--    Set name_de = name where name_de is null (better than nothing).
-- ──────────────────────────────────────────────────────────────

UPDATE catalog_entry
SET name_de = name
WHERE name_de IS NULL;

UPDATE catalog_entry
SET description_de = description
WHERE description_de IS NULL AND description IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 7. Create backward-compatible views
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW risk_catalog_v AS
SELECT
  id,
  name,
  description,
  version,
  source,
  language,
  is_active,
  target_modules,
  created_at,
  updated_at
FROM catalog
WHERE catalog_type = 'risk';

CREATE OR REPLACE VIEW control_catalog_v AS
SELECT
  id,
  name,
  description,
  version,
  source,
  language,
  is_active,
  target_modules,
  created_at,
  updated_at
FROM catalog
WHERE catalog_type = 'control';

CREATE OR REPLACE VIEW risk_catalog_entry_v AS
SELECT
  ce.id,
  ce.catalog_id,
  ce.parent_entry_id,
  ce.code,
  ce.name_de AS title_de,
  ce.name AS title_en,
  ce.description_de,
  ce.description AS description_en,
  ce.level,
  (ce.metadata->>'risk_category')::varchar(50) AS risk_category,
  (ce.metadata->>'default_likelihood')::integer AS default_likelihood,
  (ce.metadata->>'default_impact')::integer AS default_impact,
  ce.sort_order,
  (ce.status = 'active') AS is_active,
  ce.metadata AS metadata_json,
  ce.created_at
FROM catalog_entry ce
JOIN catalog c ON c.id = ce.catalog_id
WHERE c.catalog_type = 'risk';

CREATE OR REPLACE VIEW control_catalog_entry_v AS
SELECT
  ce.id,
  ce.catalog_id,
  ce.parent_entry_id,
  ce.code,
  ce.name_de AS title_de,
  ce.name AS title_en,
  ce.description_de,
  ce.description AS description_en,
  (ce.metadata->>'implementation_de')::text AS implementation_de,
  (ce.metadata->>'implementation_en')::text AS implementation_en,
  ce.level,
  (ce.metadata->>'control_type')::varchar(50) AS control_type_cat,
  (ce.metadata->>'default_frequency')::varchar(50) AS default_frequency,
  ce.sort_order,
  (ce.status = 'active') AS is_active,
  ce.metadata AS metadata_json,
  ce.created_at
FROM catalog_entry ce
JOIN catalog c ON c.id = ce.catalog_id
WHERE c.catalog_type = 'control';

-- ──────────────────────────────────────────────────────────────
-- 8. Create index on new columns
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS ce_name_de_idx ON catalog_entry (name_de);
CREATE INDEX IF NOT EXISTS ce_status_idx ON catalog_entry (status);

COMMIT;
