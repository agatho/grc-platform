-- Sprint 74: Tax CMS und Financial Compliance
-- Migration 1004: Create tax_cms_element table

CREATE TABLE IF NOT EXISTS tax_cms_element (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  element_code VARCHAR(30) NOT NULL,
  element_number INT NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  element_type VARCHAR(50) NOT NULL,
  requirements JSONB DEFAULT '[]',
  maturity_level INT DEFAULT 0,
  maturity_justification TEXT,
  responsible_id UUID REFERENCES "user"(id),
  last_assessed_at TIMESTAMPTZ,
  next_assessment_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tcms_el_code_idx ON tax_cms_element(org_id, element_code);
CREATE INDEX tcms_el_org_idx ON tax_cms_element(org_id);
CREATE INDEX tcms_el_type_idx ON tax_cms_element(org_id, element_type);
CREATE INDEX tcms_el_status_idx ON tax_cms_element(org_id, status);

ALTER TABLE tax_cms_element ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_cms_element_org_isolation ON tax_cms_element
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER tax_cms_element_audit
  AFTER INSERT OR UPDATE OR DELETE ON tax_cms_element
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
