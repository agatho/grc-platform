-- Sprint 77: Embedded BI und Report Builder
-- Migration 1017: Create bi_report_widget table

DO $$ BEGIN
  CREATE TYPE bi_widget_type AS ENUM ('kpi_card', 'bar_chart', 'line_chart', 'donut_chart', 'heatmap', 'table', 'text_block', 'radar_chart', 'gauge', 'treemap');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bi_data_source_type AS ENUM ('erm', 'isms', 'audit', 'bcms', 'esg', 'ics', 'dpms', 'tprm', 'bpm', 'custom_sql');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bi_report_widget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  report_id UUID NOT NULL REFERENCES bi_report(id) ON DELETE CASCADE,
  widget_type bi_widget_type NOT NULL,
  title VARCHAR(300),
  data_source_type bi_data_source_type NOT NULL,
  query_id UUID,
  config_json JSONB NOT NULL DEFAULT '{}',
  position_json JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bi_rw_org_idx ON bi_report_widget(org_id);
CREATE INDEX bi_rw_report_idx ON bi_report_widget(report_id);

ALTER TABLE bi_report_widget ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_report_widget_org_isolation ON bi_report_widget
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER bi_report_widget_audit
  AFTER INSERT OR UPDATE OR DELETE ON bi_report_widget
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
