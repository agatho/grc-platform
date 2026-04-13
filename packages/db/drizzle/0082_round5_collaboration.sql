-- Migration 0082: Implementierungsrunde 5 — Erweiterte Kollaboration
-- Inline Comments, Review Cycles, Structured Requests, Reminders, Messaging

-- ──────────────────────────────────────────────────────────────
-- 1. Inline Comments — Generic comment system for all entities
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inline_comment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  entity_type     varchar(50) NOT NULL,
  entity_id       uuid NOT NULL,
  field_name      varchar(100),
  content         text NOT NULL,
  parent_id       uuid REFERENCES inline_comment(id),
  is_resolved     boolean NOT NULL DEFAULT false,
  resolved_by     uuid,
  resolved_at     timestamptz,
  mentioned_users uuid[] DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ic_entity_idx ON inline_comment(entity_type, entity_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ic_org_idx ON inline_comment(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ic_unresolved_idx ON inline_comment(entity_type, entity_id) WHERE NOT is_resolved;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 2. Review Cycles — Structured review with escalation
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_cycle (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  entity_type     varchar(50) NOT NULL,
  entity_id       uuid NOT NULL,
  name            varchar(255) NOT NULL,
  reviewers       jsonb NOT NULL DEFAULT '[]',
  current_reviewer_index integer DEFAULT 0,
  status          varchar(20) NOT NULL DEFAULT 'pending',
  escalation_days integer DEFAULT 5,
  escalation_to   uuid,
  started_at      timestamptz,
  completed_at    timestamptz,
  due_date        date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS review_decision (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid NOT NULL REFERENCES review_cycle(id) ON DELETE CASCADE,
  reviewer_id     uuid NOT NULL,
  decision        varchar(20) NOT NULL,
  comment         text,
  decided_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rc_entity_idx ON review_cycle(entity_type, entity_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rd_cycle_idx ON review_decision(cycle_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 3. Structured Content Requests
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_request (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  entity_type     varchar(50),
  entity_id       uuid,
  title           varchar(500) NOT NULL,
  description     text,
  requested_fields jsonb DEFAULT '[]',
  requested_from  uuid NOT NULL,
  requested_by    uuid NOT NULL,
  due_date        date,
  priority        varchar(20) DEFAULT 'medium',
  status          varchar(20) NOT NULL DEFAULT 'pending',
  response_data   jsonb DEFAULT '{}',
  responded_at    timestamptz,
  reminder_count  integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cr_org_idx ON content_request(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cr_from_idx ON content_request(requested_from, status);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 4. Automated Reminders Engine
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reminder_rule (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  name            varchar(255) NOT NULL,
  entity_type     varchar(50) NOT NULL,
  condition_field varchar(100) NOT NULL,
  condition_type  varchar(30) NOT NULL DEFAULT 'days_before_due',
  condition_value integer NOT NULL DEFAULT 7,
  channel         varchar(20) NOT NULL DEFAULT 'in_app',
  template        text,
  is_active       boolean NOT NULL DEFAULT true,
  last_executed   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rr_org_idx ON reminder_rule(org_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 5. Messaging Integration Config
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messaging_integration (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  provider        varchar(30) NOT NULL,
  name            varchar(255) NOT NULL,
  webhook_url     text,
  channel_id      varchar(255),
  event_types     text[] DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  last_sent_at    timestamptz,
  error_count     integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  CONSTRAINT mi_org_provider_name_uq UNIQUE (org_id, provider, name)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS mi_org_idx ON messaging_integration(org_id);
