-- Sprint 64: Identity und SaaS Connectors
-- Migration 946: Create identity_connector_config table

CREATE TABLE IF NOT EXISTS identity_connector_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  identity_provider VARCHAR(50) NOT NULL,
  tenant_id VARCHAR(255),
  domain VARCHAR(255),
  sync_enabled BOOLEAN NOT NULL DEFAULT false,
  sync_interval VARCHAR(20) NOT NULL DEFAULT 'daily',
  mfa_check_enabled BOOLEAN NOT NULL DEFAULT true,
  stale_account_days INT NOT NULL DEFAULT 90,
  password_policy_check BOOLEAN NOT NULL DEFAULT true,
  access_review_enabled BOOLEAN NOT NULL DEFAULT true,
  privileged_account_monitoring BOOLEAN NOT NULL DEFAULT true,
  guest_access_check BOOLEAN NOT NULL DEFAULT true,
  conditional_access_check BOOLEAN NOT NULL DEFAULT true,
  dlp_enabled BOOLEAN NOT NULL DEFAULT false,
  retention_policy_check BOOLEAN NOT NULL DEFAULT false,
  onboarding_check BOOLEAN NOT NULL DEFAULT false,
  offboarding_check BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'pending',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX icc_org_idx ON identity_connector_config(org_id);
CREATE INDEX icc_connector_idx ON identity_connector_config(connector_id);
CREATE INDEX icc_provider_idx ON identity_connector_config(identity_provider);

-- RLS
ALTER TABLE identity_connector_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY identity_connector_config_org_isolation ON identity_connector_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER identity_connector_config_audit AFTER INSERT OR UPDATE OR DELETE ON identity_connector_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
