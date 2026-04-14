-- Fix SoA: Populate control_catalog_entry from ISO 27001 Annex A catalog_entry
-- and create SoA entries for ALL 97 Annex A controls

-- Step 1: Create control_catalog for ISO 27001 Annex A
INSERT INTO control_catalog (id, name, description, version, source, language, entry_count, is_system, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-270010000106',
  'ISO/IEC 27001:2022 Annex A',
  'ISO 27001:2022 Annex A Controls for Statement of Applicability',
  '2022',
  'iso_27001_2022_annex_a',
  'de',
  97,
  true,
  true,
  '{isms,ics}'
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Copy Annex A entries from catalog_entry to control_catalog_entry
INSERT INTO control_catalog_entry (id, catalog_id, code, title_de, title_en, description_de, description_en, level, sort_order, is_active)
SELECT
  ce.id,
  'c0000000-0000-0000-0000-270010000106',
  ce.code,
  COALESCE(ce.name_de, ce.name),
  ce.name,
  ce.description_de,
  ce.description,
  CASE WHEN ce.code ~ '^A\.\d+$' THEN 1 ELSE 2 END,
  COALESCE(ce.sort_order, 0),
  true
FROM catalog_entry ce
WHERE ce.catalog_id = 'c0000000-0000-0000-0000-270010000006'
  AND ce.status = 'active'
ON CONFLICT (id) DO NOTHING;

-- Step 3: Create SoA entries for ALL Annex A controls (ISO 27001 requirement)
INSERT INTO soa_entry (org_id, catalog_entry_id, applicability, implementation, created_at, updated_at)
SELECT
  'c2446a5c-64f1-40a7-862a-8ab084f66f41',
  cce.id,
  'applicable',
  'not_implemented',
  now(),
  now()
FROM control_catalog_entry cce
WHERE cce.catalog_id = 'c0000000-0000-0000-0000-270010000106'
  AND cce.is_active = true
  AND cce.code LIKE 'A.%.%'  -- Only leaf controls, not group headers
ON CONFLICT (org_id, catalog_entry_id) DO NOTHING;
