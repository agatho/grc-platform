-- Sprint 74: Tax CMS und Financial Compliance
-- Migration 1005: Create tax_risk table

CREATE TABLE IF NOT EXISTS tax_risk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  risk_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  tax_type VARCHAR(50) NOT NULL,
  risk_category VARCHAR(50) NOT NULL,
  jurisdiction VARCHAR(100) NOT NULL,
  affected_entities JSONB DEFAULT '[]',
  likelihood VARCHAR(20) NOT NULL,
  financial_exposure NUMERIC(15,2),
  impact VARCHAR(20) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  treatment_strategy VARCHAR(20),
  treatment_plan TEXT,
  controls JSONB DEFAULT '[]',
  legal_basis TEXT,
  hgb91_reference BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID REFERENCES "user"(id),
  review_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'identified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX tax_risk_code_idx ON tax_risk(org_id, risk_code);
CREATE INDEX tax_risk_org_idx ON tax_risk(org_id);
CREATE INDEX tax_risk_type_idx ON tax_risk(org_id, tax_type);
CREATE INDEX tax_risk_level_idx ON tax_risk(org_id, risk_level);
CREATE INDEX tax_risk_status_idx ON tax_risk(org_id, status);

ALTER TABLE tax_risk ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_risk_org_isolation ON tax_risk
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER tax_risk_audit
  AFTER INSERT OR UPDATE OR DELETE ON tax_risk
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
