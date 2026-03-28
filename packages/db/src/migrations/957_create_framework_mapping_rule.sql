-- Sprint 66: Cross-Framework Auto-Mapping Engine
-- Migration 957: Create framework_mapping_rule table

CREATE TABLE IF NOT EXISTS framework_mapping_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  mapping_id UUID REFERENCES framework_mapping(id),
  source_framework VARCHAR(50) NOT NULL,
  source_control_id VARCHAR(100) NOT NULL,
  target_framework VARCHAR(50) NOT NULL,
  target_control_id VARCHAR(100) NOT NULL,
  rule_type VARCHAR(20) NOT NULL,
  confidence NUMERIC(5,2),
  rationale TEXT,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fmr_org_idx ON framework_mapping_rule(org_id);
CREATE INDEX fmr_mapping_idx ON framework_mapping_rule(mapping_id);
CREATE INDEX fmr_source_idx ON framework_mapping_rule(source_framework, source_control_id);
CREATE INDEX fmr_target_idx ON framework_mapping_rule(target_framework, target_control_id);

-- RLS
ALTER TABLE framework_mapping_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY framework_mapping_rule_org_isolation ON framework_mapping_rule
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER framework_mapping_rule_audit AFTER INSERT OR UPDATE OR DELETE ON framework_mapping_rule
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
