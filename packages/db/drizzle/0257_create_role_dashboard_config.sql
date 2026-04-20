-- Sprint 81: Role-Based Experience Redesign
-- Migration 1038: Create role_dashboard_config table

DO $$ BEGIN
  CREATE TYPE role_dashboard_type AS ENUM ('ciso', 'cfo', 'board', 'auditor', 'department_manager', 'risk_manager', 'dpo', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS role_dashboard_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  dashboard_type role_dashboard_type NOT NULL,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  layout_json JSONB NOT NULL DEFAULT '[]',
  widgets_json JSONB NOT NULL DEFAULT '[]',
  filters_json JSONB NOT NULL DEFAULT '{}',
  refresh_interval_seconds INT NOT NULL DEFAULT 300,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX role_dashboard_config_org_idx ON role_dashboard_config(org_id);
CREATE INDEX role_dashboard_config_type_idx ON role_dashboard_config(org_id, dashboard_type);
CREATE UNIQUE INDEX rdc_org_type_default ON role_dashboard_config(org_id, dashboard_type, is_default);

ALTER TABLE role_dashboard_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_dashboard_config_org_isolation ON role_dashboard_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER role_dashboard_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON role_dashboard_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
