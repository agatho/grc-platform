-- Sprint 73: EU AI Act Governance Module
-- Migration 999: Create ai_transparency_entry table

CREATE TABLE IF NOT EXISTS ai_transparency_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id) ON DELETE CASCADE,
  entry_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  public_url VARCHAR(2000),
  registration_ref VARCHAR(200),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_te_org_idx ON ai_transparency_entry(org_id);
CREATE INDEX ai_te_system_idx ON ai_transparency_entry(ai_system_id);
CREATE INDEX ai_te_type_idx ON ai_transparency_entry(org_id, entry_type);
CREATE INDEX ai_te_status_idx ON ai_transparency_entry(org_id, status);

ALTER TABLE ai_transparency_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_transparency_entry_org_isolation ON ai_transparency_entry
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER ai_transparency_entry_audit
  AFTER INSERT OR UPDATE OR DELETE ON ai_transparency_entry
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
