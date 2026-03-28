-- Sprint 83: External Stakeholder Portals
-- Migration 1048: Create portal_session table

DO $$ BEGIN
  CREATE TYPE portal_session_status AS ENUM ('active', 'expired', 'revoked', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS portal_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  portal_config_id UUID NOT NULL REFERENCES portal_config(id),
  external_email VARCHAR(500) NOT NULL,
  external_name VARCHAR(300),
  external_org VARCHAR(300),
  access_token VARCHAR(500) NOT NULL,
  status portal_session_status NOT NULL DEFAULT 'active',
  mfa_verified BOOLEAN NOT NULL DEFAULT false,
  language VARCHAR(5) NOT NULL DEFAULT 'de',
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_access_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ps_org_idx ON portal_session(org_id);
CREATE INDEX ps_token_idx ON portal_session(access_token);
CREATE INDEX ps_email_idx ON portal_session(org_id, external_email);
CREATE INDEX ps_status_idx ON portal_session(status);

ALTER TABLE portal_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_session_org_isolation ON portal_session
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER portal_session_audit
  AFTER INSERT OR UPDATE OR DELETE ON portal_session
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
