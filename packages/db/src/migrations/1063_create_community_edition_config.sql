-- Sprint 86: Community Edition und Open-Source Packaging
-- Migration 1063: Create community_edition_config table

DO $$ BEGIN
  CREATE TYPE edition_type AS ENUM ('community', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS community_edition_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  edition_type edition_type NOT NULL DEFAULT 'community',
  enabled_modules JSONB NOT NULL DEFAULT '["erm","bpm","ics","dms"]',
  max_users INT NOT NULL DEFAULT 25,
  max_entities INT NOT NULL DEFAULT 3,
  plugin_sdk_enabled BOOLEAN NOT NULL DEFAULT true,
  api_access_enabled BOOLEAN NOT NULL DEFAULT true,
  community_forum_url VARCHAR(2000),
  deployment_type VARCHAR(50) NOT NULL DEFAULT 'docker_compose',
  helm_chart_version VARCHAR(50),
  license_key VARCHAR(500),
  license_expires_at TIMESTAMPTZ,
  telemetry_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cec_org_idx ON community_edition_config(org_id);
CREATE UNIQUE INDEX cec_org_unique ON community_edition_config(org_id);

ALTER TABLE community_edition_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY community_edition_config_org_isolation ON community_edition_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER community_edition_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON community_edition_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
