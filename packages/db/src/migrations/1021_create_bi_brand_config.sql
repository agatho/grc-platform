-- Sprint 77: Embedded BI und Report Builder
-- Migration 1021: Create bi_brand_config table

CREATE TABLE IF NOT EXISTS bi_brand_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  logo_url VARCHAR(1000),
  primary_color VARCHAR(20),
  secondary_color VARCHAR(20),
  font_family VARCHAR(100),
  header_text VARCHAR(500),
  footer_text VARCHAR(500),
  confidentiality_label VARCHAR(200),
  show_page_numbers BOOLEAN NOT NULL DEFAULT true,
  custom_css TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bi_bc_org_unique ON bi_brand_config(org_id);

ALTER TABLE bi_brand_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_brand_config_org_isolation ON bi_brand_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER bi_brand_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON bi_brand_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
