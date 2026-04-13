-- Migration 0084: Implementierungsrunde 7 — Financial Reporting
-- XBRL Tagging, ESEF, Multi-Entity Consolidation, Board Reports

-- ──────────────────────────────────────────────────────────────
-- 1. XBRL Taxonomy Management
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xbrl_taxonomy (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(255) NOT NULL,
  version         varchar(50) NOT NULL,
  taxonomy_type   varchar(30) NOT NULL,
  namespace_uri   text,
  entry_point_url text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xbrl_tax_name_ver_uq UNIQUE (name, version)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS xbrl_tag (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_id     uuid NOT NULL REFERENCES xbrl_taxonomy(id) ON DELETE CASCADE,
  element_name    varchar(500) NOT NULL,
  label_en        varchar(500),
  label_de        varchar(500),
  data_type       varchar(50),
  period_type     varchar(20),
  balance_type    varchar(20),
  is_abstract     boolean DEFAULT false,
  parent_id       uuid REFERENCES xbrl_tag(id),
  sort_order      integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS xt_taxonomy_idx ON xbrl_tag(taxonomy_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS xt_element_idx ON xbrl_tag(element_name);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 2. XBRL Tagging Instances (per report)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xbrl_tagging_instance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  report_id       uuid,
  document_id     uuid,
  taxonomy_id     uuid NOT NULL REFERENCES xbrl_taxonomy(id),
  tag_id          uuid NOT NULL REFERENCES xbrl_tag(id),
  tagged_value    text,
  context_period  varchar(50),
  context_entity  varchar(255),
  unit            varchar(50),
  decimals        integer,
  is_extension    boolean DEFAULT false,
  tagged_by       uuid,
  tagged_at       timestamptz NOT NULL DEFAULT now(),
  status          varchar(20) NOT NULL DEFAULT 'draft'
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS xti_org_idx ON xbrl_tagging_instance(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS xti_report_idx ON xbrl_tagging_instance(report_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS xti_doc_idx ON xbrl_tagging_instance(document_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 3. Multi-Entity Financial Consolidation
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consolidation_group (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  name            varchar(255) NOT NULL,
  description     text,
  parent_entity_id uuid,
  consolidation_method varchar(30) NOT NULL DEFAULT 'full',
  ownership_pct   numeric(5,2),
  currency        varchar(3) DEFAULT 'EUR',
  fiscal_year_end varchar(5) DEFAULT '12-31',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS consolidation_entry (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES consolidation_group(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL,
  entity_id       uuid NOT NULL,
  reporting_period varchar(10) NOT NULL,
  entry_type      varchar(30) NOT NULL DEFAULT 'reported',
  account_code    varchar(50),
  account_name    varchar(255),
  amount          numeric(18,2),
  currency        varchar(3) DEFAULT 'EUR',
  fx_rate         numeric(12,6),
  amount_eur      numeric(18,2),
  elimination_type varchar(30),
  notes           text,
  status          varchar(20) NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ce_group_idx ON consolidation_entry(group_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ce_period_idx ON consolidation_entry(reporting_period);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 4. Board Report Builder
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS board_report (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  title           varchar(500) NOT NULL,
  report_type     varchar(30) NOT NULL DEFAULT 'quarterly',
  reporting_period varchar(10),
  sections        jsonb NOT NULL DEFAULT '[]',
  data_snapshots  jsonb DEFAULT '{}',
  status          varchar(20) NOT NULL DEFAULT 'draft',
  presented_at    date,
  presented_to    varchar(255),
  approved_by     uuid,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS br_org_idx ON board_report(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS br_period_idx ON board_report(reporting_period);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 5. ESEF Reporting Config
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS esef_filing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  fiscal_year     integer NOT NULL,
  lei_code        varchar(20),
  filing_type     varchar(30) NOT NULL DEFAULT 'annual',
  taxonomy_version varchar(50),
  document_id     uuid,
  xhtml_content   text,
  validation_status varchar(20) DEFAULT 'not_validated',
  validation_errors jsonb DEFAULT '[]',
  filed_at        timestamptz,
  filed_to        varchar(100),
  status          varchar(20) NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  CONSTRAINT esef_org_year_uq UNIQUE (org_id, fiscal_year, filing_type)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS esef_org_idx ON esef_filing(org_id, fiscal_year);
