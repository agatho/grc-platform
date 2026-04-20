-- Sprint 82: Integration Marketplace
-- Migration 1043: Create marketplace_version table

DO $$ BEGIN
  CREATE TYPE marketplace_version_status AS ENUM ('draft', 'under_review', 'approved', 'rejected', 'deprecated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS marketplace_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  listing_id UUID NOT NULL REFERENCES marketplace_listing(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  release_notes TEXT,
  package_url VARCHAR(2000),
  package_size INT,
  checksum_sha256 VARCHAR(64),
  status marketplace_version_status NOT NULL DEFAULT 'draft',
  compatibility_json JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES "user"(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mp_ver_org_idx ON marketplace_version(org_id);
CREATE INDEX mp_ver_listing_idx ON marketplace_version(listing_id);
CREATE UNIQUE INDEX mp_ver_listing_version ON marketplace_version(listing_id, version);

ALTER TABLE marketplace_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_version_org_isolation ON marketplace_version
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER marketplace_version_audit
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_version
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
