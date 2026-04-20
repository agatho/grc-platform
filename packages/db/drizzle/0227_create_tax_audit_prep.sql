-- Sprint 74: Tax CMS und Financial Compliance
-- Migration 1008: Create tax_audit_prep table

CREATE TABLE IF NOT EXISTS tax_audit_prep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  prep_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  audit_type VARCHAR(50) NOT NULL,
  tax_years JSONB DEFAULT '[]',
  tax_types TEXT[],
  audit_authority VARCHAR(200),
  auditor_name VARCHAR(200),
  expected_start_date DATE,
  actual_start_date DATE,
  end_date DATE,
  document_checklist JSONB DEFAULT '[]',
  open_items JSONB DEFAULT '[]',
  findings JSONB DEFAULT '[]',
  total_exposure NUMERIC(15,2),
  coordinator_id UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'preparation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tax_prep_code_idx ON tax_audit_prep(org_id, prep_code);
CREATE INDEX tax_prep_org_idx ON tax_audit_prep(org_id);
CREATE INDEX tax_prep_type_idx ON tax_audit_prep(org_id, audit_type);
CREATE INDEX tax_prep_status_idx ON tax_audit_prep(org_id, status);
CREATE INDEX tax_prep_date_idx ON tax_audit_prep(org_id, expected_start_date);

ALTER TABLE tax_audit_prep ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_audit_prep_org_isolation ON tax_audit_prep
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER tax_audit_prep_audit
  AFTER INSERT OR UPDATE OR DELETE ON tax_audit_prep
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
