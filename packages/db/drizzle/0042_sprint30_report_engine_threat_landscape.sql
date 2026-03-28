-- Sprint 30: Report Engine + Threat Landscape Dashboard
-- Migrations 387–394 consolidated

-- ──────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE report_module_scope AS ENUM ('erm','ics','isms','audit','dpms','esg','bcms','tprm','all');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_generation_status AS ENUM ('queued','generating','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_output_format AS ENUM ('pdf','xlsx');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_section_type AS ENUM ('title','text','table','chart','kpi','page_break');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE threat_feed_type AS ENUM ('rss','atom','json');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 387: report_template
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  description TEXT,
  module_scope report_module_scope NOT NULL DEFAULT 'all',
  sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  parameters_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  branding_json JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rt_org_idx ON report_template(org_id);
CREATE INDEX IF NOT EXISTS rt_scope_idx ON report_template(org_id, module_scope);

-- ──────────────────────────────────────────────────────────────
-- 388: report_generation_log
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  template_id UUID NOT NULL REFERENCES report_template(id),
  status report_generation_status NOT NULL DEFAULT 'queued',
  parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_format report_output_format NOT NULL DEFAULT 'pdf',
  file_path VARCHAR(1000),
  file_size INTEGER,
  generation_time_ms INTEGER,
  error TEXT,
  generated_by UUID REFERENCES "user"(id),
  schedule_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS rgl_org_idx ON report_generation_log(org_id);
CREATE INDEX IF NOT EXISTS rgl_status_idx ON report_generation_log(org_id, status);
CREATE INDEX IF NOT EXISTS rgl_template_idx ON report_generation_log(template_id);

-- ──────────────────────────────────────────────────────────────
-- 389: report_schedule
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  template_id UUID NOT NULL REFERENCES report_template(id),
  name VARCHAR(500),
  cron_expression VARCHAR(100) NOT NULL,
  parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_format report_output_format NOT NULL DEFAULT 'pdf',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rs_org_idx ON report_schedule(org_id);
CREATE INDEX IF NOT EXISTS rs_next_run_idx ON report_schedule(is_active, next_run_at);

-- Add FK from generation_log.schedule_id after schedule table exists
ALTER TABLE report_generation_log
  ADD CONSTRAINT rgl_schedule_fk FOREIGN KEY (schedule_id) REFERENCES report_schedule(id);

-- ──────────────────────────────────────────────────────────────
-- 390: threat_feed_source
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS threat_feed_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(200) NOT NULL,
  feed_url VARCHAR(1000) NOT NULL,
  feed_type threat_feed_type NOT NULL DEFAULT 'rss',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fetch_at TIMESTAMPTZ,
  last_item_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tfs_org_idx ON threat_feed_source(org_id);
CREATE INDEX IF NOT EXISTS tfs_active_idx ON threat_feed_source(org_id, is_active);

-- ──────────────────────────────────────────────────────────────
-- 390b: threat_feed_item — cached feed entries
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS threat_feed_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  source_id UUID NOT NULL REFERENCES threat_feed_source(id) ON DELETE CASCADE,
  title VARCHAR(1000) NOT NULL,
  description TEXT,
  link VARCHAR(2000),
  published_at TIMESTAMPTZ,
  guid VARCHAR(500),
  category VARCHAR(200),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tfi_org_idx ON threat_feed_item(org_id);
CREATE INDEX IF NOT EXISTS tfi_source_idx ON threat_feed_item(source_id);
CREATE INDEX IF NOT EXISTS tfi_published_idx ON threat_feed_item(org_id, published_at);

-- ──────────────────────────────────────────────────────────────
-- 391: RLS on all Sprint 30 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE report_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_feed_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_feed_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_template_org_isolation ON report_template
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY report_generation_log_org_isolation ON report_generation_log
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY report_schedule_org_isolation ON report_schedule
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY threat_feed_source_org_isolation ON threat_feed_source
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY threat_feed_item_org_isolation ON threat_feed_item
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- 392: Audit triggers on Sprint 30 tables
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER report_template_audit
  AFTER INSERT OR UPDATE OR DELETE ON report_template
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER report_generation_log_audit
  AFTER INSERT OR UPDATE OR DELETE ON report_generation_log
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER report_schedule_audit
  AFTER INSERT OR UPDATE OR DELETE ON report_schedule
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER threat_feed_source_audit
  AFTER INSERT OR UPDATE OR DELETE ON threat_feed_source
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER threat_feed_item_audit
  AFTER INSERT OR UPDATE OR DELETE ON threat_feed_item
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 393: Seed 8 default report templates
-- (Uses a placeholder org_id — seeded per-org on first module enable)
-- ──────────────────────────────────────────────────────────────

-- Default templates will be seeded per-org via application code
-- when the reporting module is first enabled for an organization.

-- ──────────────────────────────────────────────────────────────
-- 394: Seed threat feeds (per-org via application code)
-- ──────────────────────────────────────────────────────────────

-- Default threat feeds (CERT-Bund, BSI, US-CERT) will be seeded
-- per-org via application code when the isms module is enabled.

-- ──────────────────────────────────────────────────────────────
-- Register 'reporting' module definition
-- ──────────────────────────────────────────────────────────────

INSERT INTO module_definition (
  module_key, display_name_de, display_name_en,
  description_de, description_en,
  icon, nav_path, nav_section, nav_order,
  requires_modules, license_tier, is_active_in_platform,
  background_processes
) VALUES (
  'reporting',
  'Berichtswesen',
  'Report Engine',
  'Zentrale Berichtsvorlagen, PDF/Excel-Generierung und geplante Berichte',
  'Central report templates, PDF/Excel generation and scheduled reports',
  'FileText',
  '/reports',
  'management',
  85,
  '[]'::jsonb,
  'professional',
  '["report-scheduler"]'::jsonb
) ON CONFLICT (module_key) DO NOTHING;
