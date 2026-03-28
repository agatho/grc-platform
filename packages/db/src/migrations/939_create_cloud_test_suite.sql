-- Sprint 63: Cloud Infrastructure Connectors
-- Migration 939: Create cloud_test_suite table

CREATE TABLE IF NOT EXISTS cloud_test_suite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  suite_name VARCHAR(255) NOT NULL,
  description TEXT,
  test_keys JSONB NOT NULL DEFAULT '[]',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_pass_rate NUMERIC(5,2),
  total_tests INT NOT NULL DEFAULT 0,
  passing_tests INT NOT NULL DEFAULT 0,
  failing_tests INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cts_org_idx ON cloud_test_suite(org_id);
CREATE INDEX cts_connector_idx ON cloud_test_suite(connector_id);
CREATE INDEX cts_provider_idx ON cloud_test_suite(provider);

-- RLS
ALTER TABLE cloud_test_suite ENABLE ROW LEVEL SECURITY;
CREATE POLICY cloud_test_suite_org_isolation ON cloud_test_suite
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER cloud_test_suite_audit AFTER INSERT OR UPDATE OR DELETE ON cloud_test_suite
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
