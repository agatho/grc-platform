-- #NIGHT-022: cleanup of demo-DB pollution that the QA agent surfaced.
--
-- Findings on the over-night QA report:
--   * Two organizations both named "Meridian Holdings GmbH" — admins
--     could not tell them apart in the org switcher.
--   * ~6 smoke-test / load-test orgs that were created at runtime
--     (SmokeTest-*, TestOrg-*, Audit-*-NNNNNN) and never cleaned up.
--
-- Strategy: soft-delete (set deleted_at) rather than DROP. The audit
-- log keeps its referential integrity, and the orgs simply disappear
-- from the user-facing list (every list query already filters
-- deleted_at IS NULL).
--
-- The seed file (seed_demo_00_platform.sql) was also updated so that
-- fresh installs no longer create the duplicate Meridian.

BEGIN;

-- 1. Rename the demo-tenant duplicate so existing dev DBs match the
--    seed update (first one keeps its original name).
UPDATE organization
SET name = 'Meridian Holdings GmbH (Demo Tenant)'
WHERE id = 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7'
  AND name = 'Meridian Holdings GmbH';

-- 2. Soft-delete smoke-test / load-test orgs. The patterns match what
--    the QA agent and load-runners produce. We do NOT delete rows
--    from cross-tenant tables that reference these orgs — RLS already
--    hides them, and audit-log integrity stays intact.
UPDATE organization
SET deleted_at = COALESCE(deleted_at, NOW())
WHERE deleted_at IS NULL
  AND (
    name ~ '^SmokeTest-'
    OR name ~ '^TestOrg-'
    OR name ~ '^Audit-[A-Za-z]+-\d+$'
  );

COMMIT;
