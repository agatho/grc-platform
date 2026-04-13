-- Migration 0081: Implementierungsrunde 4 — Datenmanagement & Reporting
-- Data Linking, Validation Rules, Content Placeholders, Narrative Builder

-- ──────────────────────────────────────────────────────────────
-- 1. Data Linking — Live references between data points
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_link (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  source_type     varchar(50) NOT NULL,
  source_id       uuid NOT NULL,
  source_field    varchar(100) NOT NULL,
  target_type     varchar(50) NOT NULL,
  target_id       uuid NOT NULL,
  target_field    varchar(100) NOT NULL,
  link_type       varchar(30) NOT NULL DEFAULT 'reference',
  is_bidirectional boolean DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS dl_source_idx ON data_link(source_type, source_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dl_target_idx ON data_link(target_type, target_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dl_org_idx ON data_link(org_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 2. Data Quality Validation Rules
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_validation_rule (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  name            varchar(255) NOT NULL,
  description     text,
  entity_type     varchar(50) NOT NULL,
  field_name      varchar(100) NOT NULL,
  rule_type       varchar(30) NOT NULL DEFAULT 'range',
  configuration   jsonb NOT NULL DEFAULT '{}',
  severity        varchar(20) NOT NULL DEFAULT 'warning',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS data_validation_result (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         uuid NOT NULL REFERENCES data_validation_rule(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL,
  entity_type     varchar(50) NOT NULL,
  entity_id       uuid NOT NULL,
  field_name      varchar(100) NOT NULL,
  field_value     text,
  is_valid        boolean NOT NULL,
  message         text,
  checked_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS dvr_rule_idx ON data_validation_result(rule_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dvr_entity_idx ON data_validation_result(entity_type, entity_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 3. Content Placeholders — Reusable data tokens in reports
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_placeholder (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  token           varchar(100) NOT NULL,
  label           varchar(255) NOT NULL,
  description     text,
  source_type     varchar(50),
  source_id       uuid,
  source_field    varchar(100),
  static_value    text,
  format_pattern  varchar(100),
  category        varchar(50),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  CONSTRAINT cp_org_token_uq UNIQUE (org_id, token)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cp_org_idx ON content_placeholder(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cp_category_idx ON content_placeholder(org_id, category);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 4. Narrative Builder — Text blocks with embedded data
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS narrative_template (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  name            varchar(255) NOT NULL,
  description     text,
  category        varchar(50),
  content_blocks  jsonb NOT NULL DEFAULT '[]',
  placeholders    text[] DEFAULT '{}',
  language        varchar(5) DEFAULT 'de',
  version         integer NOT NULL DEFAULT 1,
  status          varchar(20) NOT NULL DEFAULT 'draft',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS narrative_instance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid REFERENCES narrative_template(id),
  org_id          uuid NOT NULL,
  entity_type     varchar(50),
  entity_id       uuid,
  report_id       uuid,
  rendered_content text,
  data_snapshot   jsonb DEFAULT '{}',
  status          varchar(20) NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS nt_org_idx ON narrative_template(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ni_org_idx ON narrative_instance(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ni_report_idx ON narrative_instance(report_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 5. Report Template Library extension
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_template (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid,
  name            varchar(255) NOT NULL,
  description     text,
  category        varchar(50) NOT NULL,
  framework       varchar(50),
  content_schema  jsonb NOT NULL DEFAULT '{}',
  sections        jsonb NOT NULL DEFAULT '[]',
  placeholders    text[] DEFAULT '{}',
  output_format   varchar(20) DEFAULT 'pdf',
  language        varchar(5) DEFAULT 'de',
  is_system       boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rt_org_idx ON report_template(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rt_category_idx ON report_template(category);
