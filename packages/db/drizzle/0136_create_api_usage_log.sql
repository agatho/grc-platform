-- Sprint 57: API Usage Tracking
-- Migration 893: Create api_usage_log table

CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  api_key_id UUID REFERENCES api_key(id),
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  status_code INT NOT NULL,
  response_time_ms INT,
  request_size INT,
  response_size INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  error_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX api_usage_org_idx ON api_usage_log(org_id);
CREATE INDEX api_usage_key_idx ON api_usage_log(api_key_id);
CREATE INDEX api_usage_created_idx ON api_usage_log(created_at);
CREATE INDEX api_usage_path_idx ON api_usage_log(org_id, path);

-- RLS
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_usage_log_org_isolation ON api_usage_log
  USING (org_id::text = current_setting('app.current_org_id', true));

-- TimescaleDB hypertable for time-series usage data (skipped if
-- the extension isn't installed — dev envs without TimescaleDB fall
-- back to a plain table, which performs fine at Alpha volumes).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('api_usage_log', 'created_at', if_not_exists => true, migrate_data => true);
  ELSE
    RAISE NOTICE 'timescaledb extension missing — api_usage_log stays a plain table';
  END IF;
END $$;
