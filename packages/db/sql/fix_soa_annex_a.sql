-- ============================================================================
-- SoA rows for ALL Annex A controls of the demo organisation
-- ============================================================================
--
-- [ARCTOS-FULL-2026-08-31 · OP-268, 2026-09-15] Steps 1 and 2 of this file —
-- the catalog header and the projection into `control_catalog_entry` — now
-- live in `seed_control_catalog_annex_a.sql` and run as a REFERENCE seed.
-- What stays here is only what requires an organisation.
--
-- The reasoning is spelled out in that new file: mixing reference data and
-- demo data in ONE transaction meant that, twice, a foreign-key error in the
-- org-dependent part rolled the tenant-independent steps back with it
-- (OP-208, OP-268).
--
-- Prerequisites: `seed_control_catalog_annex_a.sql` (REFERENCE_SEEDS) and
-- `seed_demo_00_platform.sql`, which creates the organisation. This file
-- therefore belongs in DEMO_SEEDS, after both.
-- ============================================================================

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
  AND cce.code LIKE 'A.%.%'  -- leaf controls only, not group headers
ON CONFLICT (org_id, catalog_entry_id) DO NOTHING;
