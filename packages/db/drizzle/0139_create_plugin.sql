-- Sprint 58: Extension und Plugin Architecture
-- Migration 901: Create plugin table

CREATE TABLE IF NOT EXISTS plugin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL,
  author VARCHAR(255),
  author_url VARCHAR(500),
  repository_url VARCHAR(500),
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  tags JSONB DEFAULT '[]',
  icon_url VARCHAR(500),
  entry_point VARCHAR(500) NOT NULL,
  execution_mode VARCHAR(20) NOT NULL DEFAULT 'wasm',
  permissions JSONB DEFAULT '[]',
  config_schema JSONB DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  min_platform_version VARCHAR(20),
  max_platform_version VARCHAR(20),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX plugin_category_idx ON plugin(category);
CREATE INDEX plugin_verified_idx ON plugin(is_verified);

-- Audit trigger
CREATE TRIGGER plugin_audit AFTER INSERT OR UPDATE OR DELETE ON plugin
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
