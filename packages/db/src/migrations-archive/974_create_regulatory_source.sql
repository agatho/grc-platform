-- Sprint 69: AI Regulatory Change Agent
-- Migration 974: Create regulatory_source table

CREATE TABLE IF NOT EXISTS regulatory_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  url VARCHAR(2000),
  jurisdiction VARCHAR(100) NOT NULL,
  frameworks TEXT[],
  fetch_frequency_hours INT NOT NULL DEFAULT 24,
  parser_config JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  last_fetch_error TEXT,
  total_changes_detected INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rs_org_idx ON regulatory_source(org_id);
CREATE INDEX rs_jurisdiction_idx ON regulatory_source(jurisdiction);
CREATE INDEX rs_active_idx ON regulatory_source(is_active);

ALTER TABLE regulatory_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY regulatory_source_org_isolation ON regulatory_source
  USING (org_id IS NULL OR org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER regulatory_source_audit
  AFTER INSERT OR UPDATE OR DELETE ON regulatory_source
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
