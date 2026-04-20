-- Sprint 67: GRC Copilot Enterprise Chat
-- Migration 963: Create copilot_prompt_template table

CREATE TABLE IF NOT EXISTS copilot_prompt_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organization(id),
  key VARCHAR(100) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  module_key VARCHAR(50),
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cpt_key_idx ON copilot_prompt_template(org_id, key);
CREATE INDEX cpt_category_idx ON copilot_prompt_template(category);

-- RLS (org_id can be NULL for platform-wide templates)
ALTER TABLE copilot_prompt_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_prompt_template_org_isolation ON copilot_prompt_template
  USING (org_id IS NULL OR org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER copilot_prompt_template_audit
  AFTER INSERT OR UPDATE OR DELETE ON copilot_prompt_template
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
