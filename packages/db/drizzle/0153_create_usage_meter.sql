-- Sprint 61: Usage Metering
-- Migration 923: Create usage_meter and usage_record tables

CREATE TABLE IF NOT EXISTS usage_meter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) NOT NULL,
  aggregation_type VARCHAR(20) NOT NULL DEFAULT 'sum',
  reset_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_meter_active_idx ON usage_meter(is_active);

-- Seed meters
INSERT INTO usage_meter (key, name, unit, aggregation_type) VALUES
  ('api_calls', 'API Calls', 'requests', 'sum'),
  ('storage', 'Storage Used', 'bytes', 'max'),
  ('active_users', 'Active Users', 'users', 'max'),
  ('organizations', 'Organizations', 'orgs', 'max'),
  ('risks_created', 'Risks Created', 'entities', 'sum'),
  ('controls_created', 'Controls Created', 'entities', 'sum'),
  ('documents_stored', 'Documents Stored', 'files', 'sum'),
  ('plugin_executions', 'Plugin Executions', 'executions', 'sum'),
  ('report_generations', 'Report Generations', 'reports', 'sum'),
  ('ai_tokens', 'AI Token Usage', 'tokens', 'sum')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS usage_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  meter_id UUID NOT NULL REFERENCES usage_meter(id),
  quantity NUMERIC(18, 4) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_record_org_idx ON usage_record(org_id);
CREATE INDEX usage_record_meter_idx ON usage_record(meter_id);
CREATE INDEX usage_record_period_idx ON usage_record(org_id, meter_id, period_start);

-- RLS
ALTER TABLE usage_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_record_org_isolation ON usage_record
  USING (org_id::text = current_setting('app.current_org_id', true));

-- TimescaleDB hypertable for usage data
SELECT create_hypertable('usage_record', 'created_at', if_not_exists => true, migrate_data => true);
