-- Sprint 72: DORA Compliance Module
-- Migration 987: Create dora_tlpt_plan table

CREATE TABLE IF NOT EXISTS dora_tlpt_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  plan_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  test_type VARCHAR(50) NOT NULL,
  scope TEXT,
  target_systems JSONB DEFAULT '[]',
  threat_scenarios JSONB DEFAULT '[]',
  test_provider VARCHAR(200),
  leader_id UUID REFERENCES "user"(id),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  findings JSONB DEFAULT '[]',
  findings_summary TEXT,
  remediation_deadline DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  regulatory_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dora_tlpt_code_idx ON dora_tlpt_plan(org_id, plan_code);
CREATE INDEX dora_tlpt_org_idx ON dora_tlpt_plan(org_id);
CREATE INDEX dora_tlpt_status_idx ON dora_tlpt_plan(org_id, status);
CREATE INDEX dora_tlpt_date_idx ON dora_tlpt_plan(org_id, planned_start_date);

ALTER TABLE dora_tlpt_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY dora_tlpt_plan_org_isolation ON dora_tlpt_plan
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER dora_tlpt_plan_audit
  AFTER INSERT OR UPDATE OR DELETE ON dora_tlpt_plan
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
