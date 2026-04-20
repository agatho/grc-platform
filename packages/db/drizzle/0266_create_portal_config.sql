-- Sprint 83: External Stakeholder Portals
-- Migration 1047: Create portal_config table

DO $$ BEGIN
  CREATE TYPE portal_type AS ENUM ('vendor', 'auditor', 'board_member', 'whistleblower', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS portal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  portal_type portal_type NOT NULL,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  require_mfa BOOLEAN NOT NULL DEFAULT true,
  session_timeout_minutes INT NOT NULL DEFAULT 60,
  allowed_languages JSONB NOT NULL DEFAULT '["de","en"]',
  access_permissions JSONB NOT NULL DEFAULT '[]',
  custom_css TEXT,
  welcome_message TEXT,
  privacy_policy_url VARCHAR(2000),
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX portal_config_org_idx ON portal_config(org_id);
CREATE UNIQUE INDEX pc_org_type_unique ON portal_config(org_id, portal_type);

ALTER TABLE portal_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_config_org_isolation ON portal_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER portal_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON portal_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
