-- Migration 0296: Stakeholder Register (REQ-ISMS-005)
-- ISO 27001:2022 §4.2 + ISO 22301:2019 §4.2 — Stakeholder & Erwartungen

-- ──────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE stakeholder_type AS ENUM (
    'regulator', 'customer', 'supplier', 'employee', 'investor',
    'board', 'auditor', 'community', 'media', 'partner', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE stakeholder_influence AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE stakeholder_interest AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE stakeholder_engagement_strategy AS ENUM (
    'monitor', 'keep_informed', 'keep_satisfied', 'manage_closely'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ──────────────────────────────────────────────────────────────
-- Stakeholder
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stakeholder (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organization(id),
  name                     varchar(200) NOT NULL,
  type                     stakeholder_type NOT NULL,
  description              text,
  contact_name             varchar(200),
  contact_email            varchar(320),
  contact_phone            varchar(50),
  influence                stakeholder_influence NOT NULL DEFAULT 'medium',
  interest                 stakeholder_interest NOT NULL DEFAULT 'medium',
  engagement_strategy      stakeholder_engagement_strategy DEFAULT 'keep_informed',
  tags                     jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_reviewed_at         date,
  next_review_due          date,
  review_interval_months   varchar(10) NOT NULL DEFAULT '12',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES "user"(id),
  updated_by               uuid REFERENCES "user"(id),
  deleted_at               timestamptz
);

CREATE INDEX IF NOT EXISTS stakeholder_org_idx
  ON stakeholder (org_id);
CREATE INDEX IF NOT EXISTS stakeholder_type_idx
  ON stakeholder (org_id, type);
CREATE INDEX IF NOT EXISTS stakeholder_review_idx
  ON stakeholder (org_id, next_review_due);

-- RLS
ALTER TABLE stakeholder ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_stakeholder ON stakeholder;
CREATE POLICY rls_stakeholder ON stakeholder
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit-Trigger
DROP TRIGGER IF EXISTS audit_stakeholder ON stakeholder;
CREATE TRIGGER audit_stakeholder
  AFTER INSERT OR UPDATE OR DELETE ON stakeholder
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- Stakeholder Expectation
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stakeholder_expectation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organization(id),
  stakeholder_id      uuid NOT NULL REFERENCES stakeholder(id) ON DELETE CASCADE,
  expectation         text NOT NULL,
  status              varchar(30) NOT NULL DEFAULT 'open',
  priority            varchar(20) NOT NULL DEFAULT 'medium',
  source_type         varchar(50),
  source_reference    varchar(200),
  linked_entity_type  varchar(50),
  linked_entity_id    uuid,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES "user"(id),
  CONSTRAINT stakeholder_exp_status_check CHECK (
    status IN ('open', 'acknowledged', 'in_progress', 'met', 'unmet', 'obsolete')
  ),
  CONSTRAINT stakeholder_exp_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'critical')
  )
);

CREATE INDEX IF NOT EXISTS stakeholder_exp_org_idx
  ON stakeholder_expectation (org_id);
CREATE INDEX IF NOT EXISTS stakeholder_exp_stakeholder_idx
  ON stakeholder_expectation (stakeholder_id);
CREATE INDEX IF NOT EXISTS stakeholder_exp_status_idx
  ON stakeholder_expectation (org_id, status);

-- RLS
ALTER TABLE stakeholder_expectation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_stakeholder_expectation ON stakeholder_expectation;
CREATE POLICY rls_stakeholder_expectation ON stakeholder_expectation
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit-Trigger
DROP TRIGGER IF EXISTS audit_stakeholder_expectation ON stakeholder_expectation;
CREATE TRIGGER audit_stakeholder_expectation
  AFTER INSERT OR UPDATE OR DELETE ON stakeholder_expectation
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
