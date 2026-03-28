-- Sprint 62: Evidence Connector Framework
-- Migration 935: Create connector_health_check table

CREATE TABLE IF NOT EXISTS connector_health_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  response_time_ms INT,
  check_type VARCHAR(30) NOT NULL,
  error_message TEXT,
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chc_connector_idx ON connector_health_check(connector_id);
CREATE INDEX chc_org_idx ON connector_health_check(org_id);
CREATE INDEX chc_checked_idx ON connector_health_check(checked_at);

-- RLS
ALTER TABLE connector_health_check ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_health_check_org_isolation ON connector_health_check
  USING (org_id = current_setting('app.current_org_id')::uuid);
