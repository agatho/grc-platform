-- Sprint 72: DORA Compliance Module
-- Migration 986: Create dora_ict_risk table

CREATE TABLE IF NOT EXISTS dora_ict_risk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  risk_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  dora_article_ref VARCHAR(50),
  ict_asset_type VARCHAR(50) NOT NULL,
  threat_category VARCHAR(100),
  vulnerability_description TEXT,
  likelihood VARCHAR(20) NOT NULL,
  impact VARCHAR(20) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  residual_risk_level VARCHAR(20),
  treatment_strategy VARCHAR(20),
  treatment_plan TEXT,
  existing_controls JSONB DEFAULT '[]',
  affected_services JSONB DEFAULT '[]',
  owner_id UUID REFERENCES "user"(id),
  review_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'identified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX dora_ict_risk_code_idx ON dora_ict_risk(org_id, risk_code);
CREATE INDEX dora_ict_risk_org_idx ON dora_ict_risk(org_id);
CREATE INDEX dora_ict_risk_level_idx ON dora_ict_risk(org_id, risk_level);
CREATE INDEX dora_ict_risk_status_idx ON dora_ict_risk(org_id, status);
CREATE INDEX dora_ict_risk_owner_idx ON dora_ict_risk(owner_id);

ALTER TABLE dora_ict_risk ENABLE ROW LEVEL SECURITY;
CREATE POLICY dora_ict_risk_org_isolation ON dora_ict_risk
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER dora_ict_risk_audit
  AFTER INSERT OR UPDATE OR DELETE ON dora_ict_risk
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
