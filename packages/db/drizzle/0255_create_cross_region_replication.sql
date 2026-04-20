-- Sprint 80: Multi-Region Deployment und Data Sovereignty
-- Migration 1036: Create cross_region_replication table

DO $$ BEGIN
  CREATE TYPE replication_status AS ENUM ('active', 'paused', 'failed', 'pending_approval');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cross_region_replication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  source_region_id UUID NOT NULL REFERENCES data_region(id),
  target_region_id UUID NOT NULL REFERENCES data_region(id),
  status replication_status NOT NULL DEFAULT 'pending_approval',
  replication_type VARCHAR(50) NOT NULL DEFAULT 'async',
  tables_included JSONB NOT NULL DEFAULT '[]',
  tables_excluded JSONB NOT NULL DEFAULT '[]',
  gdpr_safeguards JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  lag_seconds INT,
  approved_by UUID REFERENCES "user"(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crr_org_idx ON cross_region_replication(org_id);
CREATE INDEX crr_source_idx ON cross_region_replication(source_region_id);
CREATE INDEX crr_target_idx ON cross_region_replication(target_region_id);
CREATE INDEX crr_status_idx ON cross_region_replication(status);

ALTER TABLE cross_region_replication ENABLE ROW LEVEL SECURITY;
CREATE POLICY cross_region_replication_org_isolation ON cross_region_replication
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER cross_region_replication_audit
  AFTER INSERT OR UPDATE OR DELETE ON cross_region_replication
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
