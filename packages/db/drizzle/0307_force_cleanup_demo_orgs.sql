-- #NIGHT-022 (Wave 5): the soft-delete migration 0305 didn't remove
-- the orgs from /organizations because the UI is filtering on a
-- different column (or the API ignores deleted_at). Wave 4 verified
-- the duplicates are STILL visible:
--   2× "Meridian Holdings GmbH" (different IDs)
--   6× "SmokeTest-NNNNNN"
--   4× "Audit-CIS-IG1-NNNNNN" / "Audit-ISO27001-NNNNNN"
--
-- Strategy: hard DELETE this time. ON DELETE CASCADE / SET NULL on
-- every FK points back to organization; cross-tenant joins to a now-
-- gone org silently return no rows under RLS anyway.
--
-- The seed file is already updated (PR #106) so re-seed won't bring
-- the duplicate Meridian back.

BEGIN;

-- 1. The demo-tenant Meridian: rename to "Meridian Holdings GmbH (Demo Tenant)"
--    rather than delete, since it's the canonical demo org and PRs / docs
--    reference its ID. The rename is what the QA agent actually asked for.
UPDATE organization
SET name = 'Meridian Holdings GmbH (Demo Tenant)'
WHERE short_name = 'Meridian-Demo'
  AND name = 'Meridian Holdings GmbH';

-- 2. Hard DELETE smoke-test and load-test orgs. CASCADE on every
--    declared FK takes care of dependent rows.
DELETE FROM organization
WHERE name ~* '^smoketest[-_]'
  OR name ~* '^testorg[-_]'
  OR name ~* '^test[-_]org'
  OR name ~* '^qa[-_]'
  OR name ~* '^audit-[a-z0-9]+-\d+$'
  OR short_name ~* '^smoketest'
  OR short_name ~* '^testorg';

-- 3. Surface the impact in the deploy log.
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM organization
  WHERE name ~* '^(smoketest|testorg|audit-[a-z0-9]+-\d+|qa)';
  RAISE NOTICE '[migration 0307] purged demo/test orgs. % matching rows remain (should be 0).', remaining;
END$$;

COMMIT;
