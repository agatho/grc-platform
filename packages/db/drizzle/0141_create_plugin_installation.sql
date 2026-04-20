-- Sprint 58: Plugin Installation
-- Migration 903: Create plugin_installation table

CREATE TABLE IF NOT EXISTS plugin_installation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  plugin_id UUID NOT NULL REFERENCES plugin(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  config JSONB DEFAULT '{}',
  hook_bindings JSONB DEFAULT '[]',
  installed_by UUID NOT NULL REFERENCES "user"(id),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ,
  disabled_by UUID REFERENCES "user"(id)
);

CREATE INDEX plugin_install_org_idx ON plugin_installation(org_id);
CREATE UNIQUE INDEX plugin_install_unique_idx ON plugin_installation(org_id, plugin_id);
CREATE INDEX plugin_install_status_idx ON plugin_installation(org_id, status);

-- RLS
ALTER TABLE plugin_installation ENABLE ROW LEVEL SECURITY;
CREATE POLICY plugin_installation_org_isolation ON plugin_installation
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Audit trigger
CREATE TRIGGER plugin_installation_audit AFTER INSERT OR UPDATE OR DELETE ON plugin_installation
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
