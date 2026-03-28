-- Sprint 73: EU AI Act Governance Module
-- Migration 996: Create ai_system table

CREATE TABLE IF NOT EXISTS ai_system (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  system_code VARCHAR(30) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  purpose TEXT,
  ai_technique VARCHAR(100),
  risk_classification VARCHAR(20) NOT NULL,
  risk_justification TEXT,
  annex_category VARCHAR(50),
  provider_or_deployer VARCHAR(20) NOT NULL,
  provider_name VARCHAR(500),
  provider_jurisdiction VARCHAR(100),
  deployment_date DATE,
  training_data JSONB DEFAULT '{}',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  affected_persons JSONB DEFAULT '[]',
  technical_documentation JSONB DEFAULT '{}',
  human_oversight_required BOOLEAN NOT NULL DEFAULT false,
  transparency_obligations JSONB DEFAULT '[]',
  owner_id UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX ai_sys_code_idx ON ai_system(org_id, system_code);
CREATE INDEX ai_sys_org_idx ON ai_system(org_id);
CREATE INDEX ai_sys_risk_idx ON ai_system(org_id, risk_classification);
CREATE INDEX ai_sys_status_idx ON ai_system(org_id, status);
CREATE INDEX ai_sys_owner_idx ON ai_system(owner_id);

ALTER TABLE ai_system ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_system_org_isolation ON ai_system
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER ai_system_audit
  AFTER INSERT OR UPDATE OR DELETE ON ai_system
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
