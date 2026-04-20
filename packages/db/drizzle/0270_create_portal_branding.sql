-- Sprint 83: External Stakeholder Portals
-- Migration 1051: Create portal_branding table

CREATE TABLE IF NOT EXISTS portal_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  portal_config_id UUID NOT NULL REFERENCES portal_config(id) ON DELETE CASCADE,
  logo_url VARCHAR(2000),
  favicon_url VARCHAR(2000),
  primary_color VARCHAR(7) NOT NULL DEFAULT '#2563EB',
  secondary_color VARCHAR(7) NOT NULL DEFAULT '#1E40AF',
  font_family VARCHAR(200) DEFAULT 'Inter',
  header_html TEXT,
  footer_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pb_org_idx ON portal_branding(org_id);
CREATE UNIQUE INDEX pb_portal_unique ON portal_branding(portal_config_id);

ALTER TABLE portal_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_branding_org_isolation ON portal_branding
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER portal_branding_audit
  AFTER INSERT OR UPDATE OR DELETE ON portal_branding
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
