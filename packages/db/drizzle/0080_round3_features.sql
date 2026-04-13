-- Migration 0080: Implementierungsrunde 3
-- Continuous Monitoring, Policy Attestation, SOX Scoping, Checklists, Evidence Requests

-- ──────────────────────────────────────────────────────────────
-- 1. Continuous Control Monitoring
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS control_monitoring_rule (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  control_id      uuid,
  name            varchar(255) NOT NULL,
  description     text,
  rule_type       varchar(30) NOT NULL DEFAULT 'threshold',
  configuration   jsonb NOT NULL DEFAULT '{}',
  check_frequency varchar(20) NOT NULL DEFAULT 'daily',
  is_active       boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_result     varchar(20),
  consecutive_failures integer DEFAULT 0,
  alert_threshold integer DEFAULT 3,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS control_monitoring_result (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         uuid NOT NULL REFERENCES control_monitoring_rule(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL,
  result          varchar(20) NOT NULL,
  value           numeric(15,4),
  expected_value  numeric(15,4),
  deviation       numeric(10,4),
  details         jsonb DEFAULT '{}',
  checked_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cmr_rule_idx ON control_monitoring_result(rule_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cmr_org_idx ON control_monitoring_result(org_id, checked_at);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 2. Policy Attestation Campaigns
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attestation_campaign (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  name            varchar(255) NOT NULL,
  description     text,
  campaign_type   varchar(30) NOT NULL DEFAULT 'policy',
  target_role     varchar(50),
  target_users    uuid[],
  policy_ids      uuid[],
  due_date        date NOT NULL,
  reminder_days   integer[] DEFAULT '{7,3,1}',
  status          varchar(20) NOT NULL DEFAULT 'draft',
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS attestation_response (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES attestation_campaign(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  policy_id       uuid,
  response        varchar(20) NOT NULL DEFAULT 'pending',
  comment         text,
  attested_at     timestamptz,
  reminder_sent_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS att_camp_org_idx ON attestation_campaign(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS att_resp_camp_idx ON attestation_response(campaign_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS att_resp_user_idx ON attestation_response(user_id, response);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 3. SOX Scoping
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sox_scoping (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  fiscal_year     integer NOT NULL,
  materiality_threshold numeric(15,2),
  currency        varchar(3) DEFAULT 'EUR',
  status          varchar(20) NOT NULL DEFAULT 'draft',
  scoped_locations jsonb DEFAULT '[]',
  scoped_accounts jsonb DEFAULT '[]',
  scoped_assertions jsonb DEFAULT '[]',
  total_controls  integer DEFAULT 0,
  in_scope_controls integer DEFAULT 0,
  coverage_pct    numeric(5,2),
  approved_by     uuid,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  CONSTRAINT sox_org_year_uq UNIQUE (org_id, fiscal_year)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS sox_org_idx ON sox_scoping(org_id, fiscal_year);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 4. Checklists (reusable process step checklists)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS checklist_template (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  name            varchar(255) NOT NULL,
  description     text,
  category        varchar(50),
  items           jsonb NOT NULL DEFAULT '[]',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS checklist_instance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid REFERENCES checklist_template(id),
  org_id          uuid NOT NULL,
  entity_type     varchar(50),
  entity_id       uuid,
  name            varchar(255) NOT NULL,
  items           jsonb NOT NULL DEFAULT '[]',
  completed_items integer DEFAULT 0,
  total_items     integer DEFAULT 0,
  status          varchar(20) NOT NULL DEFAULT 'open',
  assigned_to     uuid,
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cl_inst_org_idx ON checklist_instance(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cl_inst_entity_idx ON checklist_instance(entity_type, entity_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 5. Evidence Requests
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_request (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  control_id      uuid,
  audit_id        uuid,
  title           varchar(500) NOT NULL,
  description     text,
  requested_from  uuid NOT NULL,
  requested_by    uuid NOT NULL,
  due_date        date,
  priority        varchar(20) DEFAULT 'medium',
  status          varchar(20) NOT NULL DEFAULT 'pending',
  evidence_id     uuid,
  response_note   text,
  responded_at    timestamptz,
  reminder_count  integer DEFAULT 0,
  last_reminder   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS evreq_org_idx ON evidence_request(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS evreq_from_idx ON evidence_request(requested_from, status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS evreq_control_idx ON evidence_request(control_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 6. Deficiency Evaluation
-- ──────────────────────────────────────────────────────────────

ALTER TABLE finding ADD COLUMN IF NOT EXISTS deficiency_level varchar(30);--> statement-breakpoint
ALTER TABLE finding ADD COLUMN IF NOT EXISTS is_material_weakness boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE finding ADD COLUMN IF NOT EXISTS aggregation_notes text;
