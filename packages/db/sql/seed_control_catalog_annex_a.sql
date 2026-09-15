-- ============================================================================
-- [ARCTOS-FULL-2026-08-31 · OP-268] ISO 27001 Annex A as a TYPED catalog
-- ============================================================================
--
-- Projects the 97 Annex A entries from the generic `catalog_entry` table
-- (filled by `seed_catalog_iso27001_annex_a.sql`) into the typed
-- `control_catalog_entry` table. This is TENANT-INDEPENDENT reference data:
-- no `org_id`, no reference to any demo organisation.
--
-- Until 2026-09-15 these two steps lived in `fix_soa_annex_a.sql`, together
-- with a third one that creates `soa_entry` rows for the demo organisation
-- `c2446a5c-…`. That mixture caused the same outage twice:
--
--   * OP-208 (wave 6C): the file sat in REFERENCE_SEEDS, i.e. before
--     `seed_demo_00_platform.sql`, which creates the organisation in the first
--     place. The runner executes each file in ONE transaction — step 3
--     violated the foreign key and rolled steps 1 and 2 back with it. Without
--     `control_catalog_entry` the SoA part of `seed_demo_01_assets_isms.sql`
--     found nothing, aborted the file and took assets, threats and
--     vulnerabilities with it; without assets `seed_demo_15_cve.sql` dies too.
--     One error, three dead files.
--   * OP-268: the same effect in `seed-all.ts`, where the OP-208 fix never
--     arrived. That runner has no `seed_demo_00_platform.sql` at all, so the
--     organisation never exists — merely moving the list entry would have
--     relocated the bug instead of fixing it.
--
-- Reference data and demo data are separated because they have different
-- prerequisites. That is the lesson, not the ordering.
-- ============================================================================

-- Step 1: catalog header
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

-- Step 2: carry the entries over from `catalog_entry`
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
