-- #NIGHT-022 (re-run): Wave 3 verification reports the duplicate
-- "Meridian Holdings GmbH" + smoke-test orgs are still visible on
-- the deployed system. Either migration 0302 was not applied yet
-- (deploy hadn't restarted the migration runner) or new smoke-test
-- orgs were created since.
--
-- This migration is fully idempotent and a superset of 0302 — safe
-- to run regardless of 0302 status.

BEGIN;

-- 1. Rename ANY duplicate-named demo Meridian (matches by short_name
--    'Meridian-Demo' so it's robust against multiple re-runs and
--    avoids depending on a hardcoded UUID).
UPDATE organization
SET name = 'Meridian Holdings GmbH (Demo Tenant)'
WHERE short_name = 'Meridian-Demo'
  AND name = 'Meridian Holdings GmbH';

-- 2. Broader pattern match for smoke-test / load-test / QA orgs.
UPDATE organization
SET deleted_at = COALESCE(deleted_at, NOW())
WHERE deleted_at IS NULL
  AND (
    name ~* '^smoketest[-_]'
    OR name ~* '^testorg[-_]'
    OR name ~* '^test[-_]org'
    OR name ~* '^qa[-_]'
    OR name ~* '^audit-[a-z]+-\d+$'
    OR short_name ~* '^smoketest'
    OR short_name ~* '^testorg'
  );

-- 3. Sanity check — surface what we just cleaned up so the next
--    deploy log shows the impact.
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cleaned_count
  FROM organization
  WHERE deleted_at IS NOT NULL
    AND (name ~* '^smoketest[-_]' OR name ~* '^testorg[-_]' OR name ~* '^audit-[a-z]+-\d+$');
  RAISE NOTICE '[migration 0305] cleaned up % demo/test orgs (cumulative)', cleaned_count;
END$$;

COMMIT;
