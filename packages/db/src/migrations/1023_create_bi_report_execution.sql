-- Sprint 77: Embedded BI und Report Builder
-- Migration 1023: Create bi_report_execution table

DO $$ BEGIN
  CREATE TYPE bi_execution_status AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bi_report_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  report_id UUID NOT NULL REFERENCES bi_report(id) ON DELETE CASCADE,
  scheduled_report_id UUID REFERENCES bi_scheduled_report(id),
  status bi_execution_status NOT NULL DEFAULT 'queued',
  output_format bi_output_format NOT NULL DEFAULT 'pdf',
  file_path VARCHAR(1000),
  file_size INT,
  execution_time_ms INT,
  parameters_json JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  triggered_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX bi_re_org_idx ON bi_report_execution(org_id);
CREATE INDEX bi_re_report_idx ON bi_report_execution(report_id);
CREATE INDEX bi_re_status_idx ON bi_report_execution(org_id, status);
CREATE INDEX bi_re_scheduled_idx ON bi_report_execution(scheduled_report_id);

ALTER TABLE bi_report_execution ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_report_execution_org_isolation ON bi_report_execution
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER bi_report_execution_audit
  AFTER INSERT OR UPDATE OR DELETE ON bi_report_execution
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
