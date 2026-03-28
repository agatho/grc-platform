-- Sprint 62: Evidence Connector Framework
-- Migration 936: Create connector_test_definition table

CREATE TABLE IF NOT EXISTS connector_test_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_key VARCHAR(100) NOT NULL UNIQUE,
  connector_type VARCHAR(50) NOT NULL,
  provider_key VARCHAR(100) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  framework_mappings JSONB DEFAULT '[]',
  test_logic JSONB NOT NULL,
  expected_result JSONB DEFAULT '{}',
  remediation_guide TEXT,
  is_built_in BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ctd_type_idx ON connector_test_definition(connector_type);
CREATE INDEX ctd_provider_idx ON connector_test_definition(provider_key);
CREATE INDEX ctd_category_idx ON connector_test_definition(category);
CREATE INDEX ctd_severity_idx ON connector_test_definition(severity);

-- Audit trigger
CREATE TRIGGER connector_test_definition_audit AFTER INSERT OR UPDATE OR DELETE ON connector_test_definition
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
