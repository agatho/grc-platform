-- Sprint 60: Mobile Application
-- Migration 916: Create device_registration table

CREATE TABLE IF NOT EXISTS device_registration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  device_token VARCHAR(500) NOT NULL,
  platform VARCHAR(20) NOT NULL,
  device_model VARCHAR(100),
  os_version VARCHAR(50),
  app_version VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  biometric_enabled BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX device_reg_org_idx ON device_registration(org_id);
CREATE INDEX device_reg_user_idx ON device_registration(user_id);
CREATE UNIQUE INDEX device_reg_token_idx ON device_registration(device_token);
CREATE INDEX device_reg_active_idx ON device_registration(user_id, is_active);

-- RLS
ALTER TABLE device_registration ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_registration_org_isolation ON device_registration
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Audit trigger
CREATE TRIGGER device_registration_audit AFTER INSERT OR UPDATE OR DELETE ON device_registration
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
