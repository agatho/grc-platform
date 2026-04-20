-- Sprint 82: Integration Marketplace
-- Migration 1045: Create marketplace_installation table

CREATE TABLE IF NOT EXISTS marketplace_installation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  listing_id UUID NOT NULL REFERENCES marketplace_listing(id),
  version_id UUID NOT NULL REFERENCES marketplace_version(id),
  installed_by UUID NOT NULL REFERENCES "user"(id),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  config_json JSONB NOT NULL DEFAULT '{}',
  auto_update BOOLEAN NOT NULL DEFAULT true,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMPTZ
);

CREATE INDEX mp_inst_org_idx ON marketplace_installation(org_id);
CREATE INDEX mp_inst_listing_idx ON marketplace_installation(listing_id);
CREATE UNIQUE INDEX mp_inst_org_listing ON marketplace_installation(org_id, listing_id);

ALTER TABLE marketplace_installation ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_installation_org_isolation ON marketplace_installation
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER marketplace_installation_audit
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_installation
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
