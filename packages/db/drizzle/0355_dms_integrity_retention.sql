-- Migration 0355: DMS Paket D3 — File integrity (SHA-256) + Retention.
--
-- 1. file_sha256 on document + document_version — hash computed at
--    upload time (node:crypto), verified by /verify-integrity and
--    surfaced via the X-File-SHA256 download header.
-- 2. retention_policy table (per-org, basis created/published/expired,
--    retention in years) + assignment columns on document incl.
--    legal_hold, which blocks both the purge cron and GDPR erasure.

BEGIN;

ALTER TABLE document ADD COLUMN IF NOT EXISTS file_sha256 varchar(64);
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS file_sha256 varchar(64);

DO $$ BEGIN
  CREATE TYPE retention_basis AS ENUM ('created', 'published', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS retention_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id),
  name varchar(255) NOT NULL,
  description text,
  retention_years integer NOT NULL CHECK (retention_years > 0),
  basis retention_basis NOT NULL DEFAULT 'created',

  -- Cross-cutting mandatory fields
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX IF NOT EXISTS retention_policy_org_idx ON retention_policy(org_id);

ALTER TABLE document ADD COLUMN IF NOT EXISTS retention_policy_id uuid REFERENCES retention_policy(id) ON DELETE SET NULL;
ALTER TABLE document ADD COLUMN IF NOT EXISTS retention_until timestamptz;
ALTER TABLE document ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;

-- Purge cron scans: retention_until < now AND legal_hold = false
CREATE INDEX IF NOT EXISTS document_retention_until_idx
  ON document(retention_until)
  WHERE retention_until IS NOT NULL AND legal_hold = false;

-- RLS
ALTER TABLE retention_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policy FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='retention_policy' AND policyname='retention_policy_tenant_select') THEN
    CREATE POLICY retention_policy_tenant_select ON retention_policy FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='retention_policy' AND policyname='retention_policy_tenant_insert') THEN
    CREATE POLICY retention_policy_tenant_insert ON retention_policy FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='retention_policy' AND policyname='retention_policy_tenant_update') THEN
    CREATE POLICY retention_policy_tenant_update ON retention_policy FOR UPDATE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='retention_policy' AND policyname='retention_policy_tenant_delete') THEN
    CREATE POLICY retention_policy_tenant_delete ON retention_policy FOR DELETE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

-- Audit trigger (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger')
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'retention_policy_audit_trigger'
         AND tgrelid = 'retention_policy'::regclass
     ) THEN
    CREATE TRIGGER retention_policy_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON retention_policy
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

COMMIT;
