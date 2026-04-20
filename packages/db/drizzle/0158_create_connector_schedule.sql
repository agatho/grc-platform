-- Sprint 62: Evidence Connector Framework
-- Migration 933: Create connector_schedule table

CREATE TABLE IF NOT EXISTS connector_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Berlin',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  test_ids JSONB DEFAULT '[]',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_status VARCHAR(20),
  last_run_duration_ms INT,
  consecutive_failures INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX csched_connector_idx ON connector_schedule(connector_id);
CREATE INDEX csched_next_run_idx ON connector_schedule(next_run_at, is_enabled);
CREATE INDEX csched_org_idx ON connector_schedule(org_id);

-- RLS
ALTER TABLE connector_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_schedule_org_isolation ON connector_schedule
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER connector_schedule_audit AFTER INSERT OR UPDATE OR DELETE ON connector_schedule
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
