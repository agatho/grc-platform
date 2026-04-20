-- Sprint 77: Embedded BI und Report Builder
-- Migration 1016: Create bi_report table

DO $$ BEGIN
  CREATE TYPE bi_report_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bi_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  description TEXT,
  status bi_report_status NOT NULL DEFAULT 'draft',
  module_scope VARCHAR(50) NOT NULL DEFAULT 'all',
  layout_json JSONB NOT NULL DEFAULT '[]',
  filters_json JSONB NOT NULL DEFAULT '{}',
  parameters_json JSONB NOT NULL DEFAULT '[]',
  is_template BOOLEAN NOT NULL DEFAULT false,
  template_category VARCHAR(100),
  thumbnail_url VARCHAR(1000),
  created_by UUID REFERENCES "user"(id),
  updated_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bi_report_org_idx ON bi_report(org_id);
CREATE INDEX bi_report_status_idx ON bi_report(org_id, status);
CREATE INDEX bi_report_template_idx ON bi_report(org_id, is_template);
CREATE INDEX bi_report_module_idx ON bi_report(org_id, module_scope);

ALTER TABLE bi_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_report_org_isolation ON bi_report
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER bi_report_audit
  AFTER INSERT OR UPDATE OR DELETE ON bi_report
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
