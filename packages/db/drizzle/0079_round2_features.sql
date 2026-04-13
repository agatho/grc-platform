-- Migration 0079: Implementierungsrunde 2
-- EU Taxonomy, Root Cause Analysis, Audit Sampling, Sign-off/Approval, Exception Reporting

-- ──────────────────────────────────────────────────────────────
-- 1. EU Taxonomy Alignment
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eu_taxonomy_assessment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  reporting_year  integer NOT NULL,
  activity_name   varchar(500) NOT NULL,
  nace_code       varchar(20),
  objective_id    varchar(10) NOT NULL,
  is_eligible     boolean,
  is_aligned      boolean,
  turnover_amount numeric(15,2),
  capex_amount    numeric(15,2),
  opex_amount     numeric(15,2),
  substantial_contribution_met boolean DEFAULT false,
  dnsh_met        boolean DEFAULT false,
  minimum_safeguards_met boolean DEFAULT false,
  justification   text,
  evidence_ids    uuid[],
  assessed_by     uuid,
  assessed_at     timestamptz,
  status          varchar(20) NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  CONSTRAINT eu_tax_org_year_activity_uq UNIQUE (org_id, reporting_year, activity_name)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS eu_tax_org_year_idx ON eu_taxonomy_assessment(org_id, reporting_year);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 2. Root Cause Analysis
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS root_cause_analysis (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  finding_id      uuid,
  incident_id     uuid,
  title           varchar(500) NOT NULL,
  description     text,
  methodology     varchar(50) NOT NULL DEFAULT '5_why',
  root_causes     jsonb NOT NULL DEFAULT '[]',
  contributing_factors jsonb DEFAULT '[]',
  corrective_actions jsonb DEFAULT '[]',
  preventive_actions jsonb DEFAULT '[]',
  status          varchar(20) NOT NULL DEFAULT 'open',
  owner_id        uuid,
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rca_org_idx ON root_cause_analysis(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rca_finding_idx ON root_cause_analysis(finding_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 3. Audit Sampling
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_sample (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  control_id      uuid,
  audit_id        uuid,
  campaign_id     uuid,
  sample_method   varchar(30) NOT NULL DEFAULT 'random',
  population_size integer NOT NULL,
  sample_size     integer NOT NULL,
  confidence_level numeric(5,2) DEFAULT 95.0,
  tolerable_error numeric(5,2) DEFAULT 5.0,
  sample_items    jsonb NOT NULL DEFAULT '[]',
  results         jsonb DEFAULT '{}',
  exceptions_found integer DEFAULT 0,
  status          varchar(20) NOT NULL DEFAULT 'planned',
  sampled_at      timestamptz,
  sampled_by      uuid,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS sample_org_idx ON audit_sample(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sample_control_idx ON audit_sample(control_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 4. Sign-off / Approval Workflows
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_workflow (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  name            varchar(255) NOT NULL,
  description     text,
  workflow_type   varchar(50) NOT NULL DEFAULT 'sequential',
  entity_type     varchar(50),
  steps           jsonb NOT NULL DEFAULT '[]',
  is_template     boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS approval_request (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  workflow_id     uuid REFERENCES approval_workflow(id),
  entity_type     varchar(50) NOT NULL,
  entity_id       uuid NOT NULL,
  title           varchar(500) NOT NULL,
  description     text,
  current_step    integer NOT NULL DEFAULT 0,
  status          varchar(20) NOT NULL DEFAULT 'pending',
  requested_by    uuid NOT NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  due_date        date,
  created_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS approval_decision (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
  step_number     integer NOT NULL,
  approver_id     uuid NOT NULL,
  decision        varchar(20) NOT NULL,
  comment         text,
  decided_at      timestamptz NOT NULL DEFAULT now(),
  delegated_from  uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS appreq_org_idx ON approval_request(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS appreq_entity_idx ON approval_request(entity_type, entity_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS appdec_request_idx ON approval_decision(request_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 5. Exception Reporting
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exception_report (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  entity_type     varchar(50) NOT NULL,
  entity_id       uuid NOT NULL,
  exception_type  varchar(50) NOT NULL,
  severity        varchar(20) NOT NULL DEFAULT 'medium',
  title           varchar(500) NOT NULL,
  description     text,
  detected_method varchar(30) NOT NULL DEFAULT 'manual',
  expected_value  text,
  actual_value    text,
  deviation       numeric(10,2),
  is_resolved     boolean NOT NULL DEFAULT false,
  resolved_by     uuid,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS exc_org_idx ON exception_report(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS exc_entity_idx ON exception_report(entity_type, entity_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS exc_unresolved_idx ON exception_report(org_id, is_resolved) WHERE NOT is_resolved;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 6. YoY ESG Consistency Tracking
-- ──────────────────────────────────────────────────────────────

ALTER TABLE esg_measurement ADD COLUMN IF NOT EXISTS previous_year_value numeric(15,4);--> statement-breakpoint
ALTER TABLE esg_measurement ADD COLUMN IF NOT EXISTS yoy_change_percent numeric(8,2);--> statement-breakpoint
ALTER TABLE esg_measurement ADD COLUMN IF NOT EXISTS yoy_explanation text;
