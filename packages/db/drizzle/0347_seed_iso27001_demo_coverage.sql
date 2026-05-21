-- Migration 0347: seed ISO 27001:2022 Annex A demo coverage rows
-- for Meridian Holdings GmbH.
--
-- #WAVE25-C1: Wave-24 D7 added the three-tier fallback in
-- /api/v1/compliance/coverage (snapshot → live cfc → catalog-link
-- heuristic). On a fresh tenant with no gap-analysis snapshots and no
-- control_framework_coverage rows, the heuristic path reads from
-- `control.catalog_entry_id` and counts coverage by catalog. Meridian's
-- seeded controls don't have catalog_entry_id set to ISO 27001 Annex A
-- entries, so the tile still showed 0%.
--
-- This migration writes 15 explicit covered/partially_covered rows into
-- control_framework_coverage that map Meridian's existing controls to
-- ISO 27001:2022 Annex A clauses. Coverage tile will show a realistic
-- ~30-50% number (depends on the org's full control count) instead of
-- 0%.
--
-- Mappings are illustrative, not authoritative. They use title-based
-- matching against Meridian's seeded controls (e.g. "Patch Management"
-- → A.8.8 Management of technical vulnerabilities). When a real
-- gap-analysis is run via POST /api/v1/framework-mappings/gap-analysis,
-- the snapshot path takes over and this seed is ignored.
--
-- Idempotent: uses the cfc_unique_idx (org_id, control_id, framework,
-- framework_control_id) and ON CONFLICT DO NOTHING.

BEGIN;

-- Helper: insert one mapping if the matching control exists.
-- Using CTE to keep the org_id constant + only insert when control found.
WITH meridian AS (
  SELECT 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7'::uuid AS org_id
),
m AS (
  -- (control title pattern, framework code, status, source)
  SELECT * FROM (VALUES
    ('%patch%',         'A.8.8',  'covered',           'mapped'),
    ('%access%control%','A.5.15', 'covered',           'mapped'),
    ('%passw%',         'A.5.17', 'covered',           'mapped'),
    ('%backup%',        'A.8.13', 'covered',           'mapped'),
    ('%incident%',      'A.5.24', 'covered',           'mapped'),
    ('%logging%',       'A.8.15', 'covered',           'mapped'),
    ('%vulnerab%',      'A.8.8',  'partially_covered', 'mapped'),
    ('%encrypt%',       'A.8.24', 'covered',           'mapped'),
    ('%firewall%',      'A.8.20', 'covered',           'mapped'),
    ('%awareness%',     'A.6.3',  'covered',           'mapped'),
    ('%supplier%',      'A.5.19', 'partially_covered', 'mapped'),
    ('%segregation%',   'A.5.3',  'covered',           'mapped'),
    ('%mobile%device%', 'A.8.1',  'partially_covered', 'mapped'),
    ('%clear%desk%',    'A.7.7',  'covered',           'mapped'),
    ('%physical%',      'A.7.2',  'covered',           'mapped')
  ) AS t(title_pat, fw_control, status, src)
),
matches AS (
  SELECT
    meridian.org_id,
    c.id AS control_id,
    m.fw_control,
    m.status,
    m.src
  FROM meridian
  CROSS JOIN m
  JOIN control c
    ON c.org_id = meridian.org_id
   AND c.deleted_at IS NULL
   AND lower(c.title) LIKE m.title_pat
),
deduped AS (
  -- multiple Meridian controls could match the same pattern; pick the
  -- first per (control_id, fw_control) so the unique-index doesn't
  -- abort the whole transaction on collision.
  SELECT DISTINCT ON (control_id, fw_control)
    org_id, control_id, fw_control, status, src
  FROM matches
)
INSERT INTO control_framework_coverage (
  org_id, control_id, framework, framework_control_id,
  coverage_status, coverage_source, evidence_status,
  last_assessed_at
)
SELECT
  org_id,
  control_id,
  'iso_27001_2022',
  fw_control,
  status,
  src,
  'fresh',
  now()
FROM deduped
ON CONFLICT ON CONSTRAINT cfc_unique_idx DO NOTHING;

COMMIT;
