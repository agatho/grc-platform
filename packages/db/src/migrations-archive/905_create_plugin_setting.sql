-- Sprint 58: Plugin Settings
-- Migration 905: Create plugin_setting table

CREATE TABLE IF NOT EXISTS plugin_setting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  installation_id UUID NOT NULL REFERENCES plugin_installation(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value JSONB DEFAULT 'null',
  is_secret BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES "user"(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX plugin_setting_unique_idx ON plugin_setting(installation_id, key);
CREATE INDEX plugin_setting_org_idx ON plugin_setting(org_id);

-- RLS
ALTER TABLE plugin_setting ENABLE ROW LEVEL SECURITY;
CREATE POLICY plugin_setting_org_isolation ON plugin_setting
  USING (org_id::text = current_setting('app.current_org_id', true));
