-- Migration 0351: seed 4 missing module_definition rows.
--
-- #IMPL-GAP-1: Sprint 56/82 modules (community, marketplace, portals,
-- simulations) have UI pages wrapped in <ModuleGate moduleKey="..."> and
-- API routes under /api/v1/{community,marketplace,portals,simulations}/
-- but there's no row for them in module_definition. The
-- use-module-config hook silently defaults a missing definition to
-- uiStatus="disabled", which means requireModule returns 404 and the
-- 11 corresponding pages disappear from the prod UI. Operators have
-- no way to enable them through the modules-admin UI either, because
-- that UI shows only rows from module_definition.
--
-- This migration backfills the 4 missing rows. Idempotent via
-- ON CONFLICT (module_key) DO NOTHING so it can re-run after the
-- baseline seed.
--
-- Identified by docs/audits/impl-gap-audit-2026-05-23.md §HIGH-1.

BEGIN;

INSERT INTO module_definition
  (module_key, display_name_de, display_name_en, icon, nav_order, license_tier)
VALUES
  ('community',
    'Community Edition',
    'Community Edition',
    'users-2',
    480,
    'included'),
  ('marketplace',
    'Marketplace',
    'Marketplace',
    'shopping-bag',
    490,
    'included'),
  ('portals',
    'Stakeholder Portals',
    'Stakeholder Portals',
    'door-open',
    500,
    'included'),
  ('simulations',
    'Simulation Engine',
    'Simulation Engine',
    'flask-conical',
    510,
    'included')
ON CONFLICT (module_key) DO NOTHING;

COMMIT;
