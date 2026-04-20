-- Sprint 72: DORA Compliance Module
-- Migration 989: Create dora_ict_provider table

CREATE TABLE IF NOT EXISTS dora_ict_provider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  provider_code VARCHAR(30) NOT NULL,
  name VARCHAR(500) NOT NULL,
  legal_entity VARCHAR(500),
  jurisdiction VARCHAR(100),
  service_description TEXT,
  service_type VARCHAR(50) NOT NULL,
  criticality VARCHAR(20) NOT NULL,
  contract_ref VARCHAR(200),
  contract_start_date DATE,
  contract_end_date DATE,
  data_processed JSONB DEFAULT '[]',
  subcontractors JSONB DEFAULT '[]',
  exit_strategy TEXT,
  risk_assessment JSONB DEFAULT '{}',
  last_audit_date DATE,
  next_audit_date DATE,
  compliance_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  owner_id UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dora_prov_code_idx ON dora_ict_provider(org_id, provider_code);
CREATE INDEX dora_prov_org_idx ON dora_ict_provider(org_id);
CREATE INDEX dora_prov_crit_idx ON dora_ict_provider(org_id, criticality);
CREATE INDEX dora_prov_status_idx ON dora_ict_provider(org_id, status);
CREATE INDEX dora_prov_compliance_idx ON dora_ict_provider(org_id, compliance_status);

ALTER TABLE dora_ict_provider ENABLE ROW LEVEL SECURITY;
CREATE POLICY dora_ict_provider_org_isolation ON dora_ict_provider
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER dora_ict_provider_audit
  AFTER INSERT OR UPDATE OR DELETE ON dora_ict_provider
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
