-- Sprint 77: Embedded BI und Report Builder
-- Migration 1022: Create bi_scheduled_report table

DO $$ BEGIN
  CREATE TYPE bi_schedule_frequency AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bi_output_format AS ENUM ('pdf', 'xlsx', 'csv', 'pptx');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bi_scheduled_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  report_id UUID NOT NULL REFERENCES bi_report(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  frequency bi_schedule_frequency NOT NULL,
  cron_expression VARCHAR(100),
  output_format bi_output_format NOT NULL DEFAULT 'pdf',
  recipient_emails JSONB NOT NULL DEFAULT '[]',
  parameters_json JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bi_sr_org_idx ON bi_scheduled_report(org_id);
CREATE INDEX bi_sr_report_idx ON bi_scheduled_report(report_id);
CREATE INDEX bi_sr_next_run_idx ON bi_scheduled_report(is_active, next_run_at);

ALTER TABLE bi_scheduled_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_scheduled_report_org_isolation ON bi_scheduled_report
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER bi_scheduled_report_audit
  AFTER INSERT OR UPDATE OR DELETE ON bi_scheduled_report
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
