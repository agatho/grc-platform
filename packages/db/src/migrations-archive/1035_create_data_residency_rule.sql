-- Sprint 80: Multi-Region Deployment und Data Sovereignty
-- Migration 1035: Create data_residency_rule table

DO $$ BEGIN
  CREATE TYPE residency_rule_type AS ENUM ('data_at_rest', 'data_in_transit', 'backup', 'logging', 'processing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance_framework_tag AS ENUM ('gdpr', 'bsi_c5', 'soc2_type2', 'iso27001', 'nis2');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS data_residency_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(300) NOT NULL,
  rule_type residency_rule_type NOT NULL,
  description TEXT,
  allowed_regions JSONB NOT NULL DEFAULT '[]',
  denied_regions JSONB NOT NULL DEFAULT '[]',
  compliance_framework compliance_framework_tag,
  is_enforced BOOLEAN NOT NULL DEFAULT true,
  violation_action VARCHAR(50) NOT NULL DEFAULT 'block',
  conditions_json JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX drr_org_idx ON data_residency_rule(org_id);
CREATE INDEX drr_type_idx ON data_residency_rule(org_id, rule_type);

ALTER TABLE data_residency_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_residency_rule_org_isolation ON data_residency_rule
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER data_residency_rule_audit
  AFTER INSERT OR UPDATE OR DELETE ON data_residency_rule
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
