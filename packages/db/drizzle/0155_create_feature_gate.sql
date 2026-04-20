-- Sprint 61: Feature Gates
-- Migration 925: Create feature_gate table

CREATE TABLE IF NOT EXISTS feature_gate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  module VARCHAR(50),
  gate_type VARCHAR(20) NOT NULL DEFAULT 'boolean',
  default_value JSONB DEFAULT 'false',
  plan_overrides JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX feature_gate_module_idx ON feature_gate(module);
CREATE INDEX feature_gate_active_idx ON feature_gate(is_active);

-- Seed feature gates
INSERT INTO feature_gate (key, name, module, gate_type, default_value, plan_overrides) VALUES
  ('api_access', 'API Access', NULL, 'boolean', 'false', '{"standard": true, "professional": true, "enterprise": true}'),
  ('sso_enabled', 'Single Sign-On', NULL, 'boolean', 'false', '{"professional": true, "enterprise": true}'),
  ('plugin_system', 'Plugin System', NULL, 'boolean', 'false', '{"standard": true, "professional": true, "enterprise": true}'),
  ('custom_branding', 'Custom Branding', NULL, 'boolean', 'false', '{"enterprise": true}'),
  ('advanced_reporting', 'Advanced Reporting', NULL, 'boolean', 'false', '{"professional": true, "enterprise": true}'),
  ('ai_features', 'AI-Powered Features', NULL, 'boolean', 'false', '{"professional": true, "enterprise": true}'),
  ('multi_entity', 'Multi-Entity Management', NULL, 'boolean', 'false', '{"standard": true, "professional": true, "enterprise": true}'),
  ('audit_module', 'Audit Management Module', 'audit', 'boolean', 'false', '{"professional": true, "enterprise": true}'),
  ('bcms_module', 'BCMS Module', 'bcms', 'boolean', 'false', '{"professional": true, "enterprise": true}'),
  ('dpms_module', 'Data Privacy Module', 'dpms', 'boolean', 'false', '{"professional": true, "enterprise": true}'),
  ('tprm_module', 'Third Party Risk Module', 'tprm', 'boolean', 'false', '{"professional": true, "enterprise": true}'),
  ('max_users', 'Maximum Users', NULL, 'numeric', '5', '{"standard": 25, "professional": 100, "enterprise": -1}'),
  ('max_api_calls', 'Maximum API Calls/Month', NULL, 'numeric', '1000', '{"standard": 50000, "professional": 500000, "enterprise": -1}'),
  ('max_storage_gb', 'Maximum Storage (GB)', NULL, 'numeric', '1', '{"standard": 10, "professional": 50, "enterprise": -1}')
ON CONFLICT (key) DO NOTHING;

-- Audit trigger
CREATE TRIGGER feature_gate_audit AFTER INSERT OR UPDATE OR DELETE ON feature_gate
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
