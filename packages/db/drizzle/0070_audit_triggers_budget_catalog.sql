-- Migration: Ensure audit triggers exist on budget + catalog tables
-- Budget tables already have audit_trigger from their creation migration.
-- org_active_catalog already has audit_org_active_catalog trigger.
-- This migration is a no-op safety net that verifies coverage.

-- Rename org_active_catalog trigger to standard name if it doesn't already exist
DO $$
BEGIN
  -- If the standard name doesn't exist but the legacy name does, add the standard one
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_trigger'
      AND tgrelid = 'org_active_catalog'::regclass
  ) AND EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_org_active_catalog'
      AND tgrelid = 'org_active_catalog'::regclass
  ) THEN
    -- Drop legacy-named trigger and recreate with standard name
    DROP TRIGGER audit_org_active_catalog ON org_active_catalog;
    CREATE TRIGGER audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON org_active_catalog
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;
