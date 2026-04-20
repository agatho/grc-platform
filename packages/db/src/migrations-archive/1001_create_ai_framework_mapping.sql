-- Sprint 73: EU AI Act Governance Module
-- Migration 1001: Create ai_framework_mapping table

CREATE TABLE IF NOT EXISTS ai_framework_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  framework VARCHAR(50) NOT NULL,
  control_ref VARCHAR(100) NOT NULL,
  control_title VARCHAR(500) NOT NULL,
  ai_act_article VARCHAR(100),
  implementation_status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  evidence JSONB DEFAULT '[]',
  notes TEXT,
  assessed_by UUID REFERENCES "user"(id),
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_fm_ref_idx ON ai_framework_mapping(org_id, framework, control_ref);
CREATE INDEX ai_fm_org_idx ON ai_framework_mapping(org_id);
CREATE INDEX ai_fm_fw_idx ON ai_framework_mapping(org_id, framework);
CREATE INDEX ai_fm_status_idx ON ai_framework_mapping(org_id, implementation_status);

ALTER TABLE ai_framework_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_framework_mapping_org_isolation ON ai_framework_mapping
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER ai_framework_mapping_audit
  AFTER INSERT OR UPDATE OR DELETE ON ai_framework_mapping
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
