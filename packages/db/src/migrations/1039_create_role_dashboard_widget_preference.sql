-- Sprint 81: Role-Based Experience Redesign
-- Migration 1039: Create role_dashboard_widget_preference table

CREATE TABLE IF NOT EXISTS role_dashboard_widget_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  dashboard_config_id UUID NOT NULL REFERENCES role_dashboard_config(id) ON DELETE CASCADE,
  widget_key VARCHAR(200) NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  position_override JSONB,
  config_override JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rdwp_org_idx ON role_dashboard_widget_preference(org_id);
CREATE INDEX rdwp_user_idx ON role_dashboard_widget_preference(user_id);
CREATE UNIQUE INDEX rdwp_user_widget_unique ON role_dashboard_widget_preference(user_id, dashboard_config_id, widget_key);

ALTER TABLE role_dashboard_widget_preference ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_dashboard_widget_preference_org_isolation ON role_dashboard_widget_preference
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER role_dashboard_widget_preference_audit
  AFTER INSERT OR UPDATE OR DELETE ON role_dashboard_widget_preference
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
