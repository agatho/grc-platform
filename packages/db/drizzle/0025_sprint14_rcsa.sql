-- Sprint 14: Risk & Control Self-Assessment (RCSA)
-- Migration 243-252: Tables, RLS, Audit triggers, Seeds, Indices

-- ──────────────────────────────────────────────────────────────
-- 243: Create rcsa_campaign
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rcsa_campaign" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "period_start" varchar(10) NOT NULL,
  "period_end" varchar(10) NOT NULL,
  "frequency" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "target_scope" jsonb NOT NULL DEFAULT '{}',
  "question_set_id" uuid,
  "reminder_days_before" integer DEFAULT 7,
  "ces_weight" integer DEFAULT 15,
  "created_by" uuid REFERENCES "user"("id"),
  "launched_at" timestamptz,
  "closed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rc_org_idx" ON "rcsa_campaign"("org_id");
CREATE INDEX IF NOT EXISTS "rc_status_idx" ON "rcsa_campaign"("org_id", "status");

-- ──────────────────────────────────────────────────────────────
-- 244: Create rcsa_assignment
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rcsa_assignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL REFERENCES "rcsa_campaign"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "user_id" uuid NOT NULL REFERENCES "user"("id"),
  "entity_type" varchar(20) NOT NULL,
  "entity_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "deadline" timestamptz NOT NULL,
  "submitted_at" timestamptz,
  "reminders_sent" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ra_campaign_idx" ON "rcsa_assignment"("campaign_id");
CREATE INDEX IF NOT EXISTS "ra_user_idx" ON "rcsa_assignment"("user_id", "status");
CREATE INDEX IF NOT EXISTS "ra_entity_idx" ON "rcsa_assignment"("entity_type", "entity_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ra_unique_idx"
  ON "rcsa_assignment"("campaign_id", "user_id", "entity_type", "entity_id");

-- ──────────────────────────────────────────────────────────────
-- 245: Create rcsa_response
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rcsa_response" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "assignment_id" uuid NOT NULL REFERENCES "rcsa_assignment"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  -- Risk assessment fields
  "risk_still_relevant" boolean,
  "likelihood_assessment" integer,
  "impact_assessment" integer,
  "risk_trend" varchar(15),
  -- Control assessment fields
  "control_effectiveness" varchar(20),
  "control_operating" boolean,
  "control_weaknesses" text,
  -- Common fields
  "comment" text,
  "evidence_ids" jsonb DEFAULT '[]',
  "confidence" integer,
  "responded_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "rcsa_response_likelihood_chk" CHECK ("likelihood_assessment" IS NULL OR ("likelihood_assessment" >= 1 AND "likelihood_assessment" <= 5)),
  CONSTRAINT "rcsa_response_impact_chk" CHECK ("impact_assessment" IS NULL OR ("impact_assessment" >= 1 AND "impact_assessment" <= 5)),
  CONSTRAINT "rcsa_response_confidence_chk" CHECK ("confidence" IS NULL OR ("confidence" >= 1 AND "confidence" <= 5))
);

CREATE INDEX IF NOT EXISTS "rr_assignment_idx" ON "rcsa_response"("assignment_id");

-- ──────────────────────────────────────────────────────────────
-- 246: Create rcsa_result
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rcsa_result" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL REFERENCES "rcsa_campaign"("id"),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "total_assignments" integer NOT NULL,
  "completed_count" integer NOT NULL,
  "completion_rate" numeric(5,2) NOT NULL,
  "avg_likelihood" numeric(3,2),
  "avg_impact" numeric(3,2),
  "risks_increasing" integer DEFAULT 0,
  "risks_stable" integer DEFAULT 0,
  "risks_decreasing" integer DEFAULT 0,
  "controls_effective" integer DEFAULT 0,
  "controls_partial" integer DEFAULT 0,
  "controls_ineffective" integer DEFAULT 0,
  "discrepancy_count" integer DEFAULT 0,
  "discrepancies" jsonb DEFAULT '[]',
  "computed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "rr_campaign_uniq_idx" ON "rcsa_result"("campaign_id");

-- ──────────────────────────────────────────────────────────────
-- 247: RLS on all 4 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "rcsa_campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rcsa_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rcsa_response" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rcsa_result" ENABLE ROW LEVEL SECURITY;

-- rcsa_campaign: org-scoped
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'rcsa_campaign_org_isolation') THEN
    CREATE POLICY "rcsa_campaign_org_isolation" ON "rcsa_campaign"
      USING ("org_id" = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- rcsa_assignment: org-scoped
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'rcsa_assignment_org_isolation') THEN
    CREATE POLICY "rcsa_assignment_org_isolation" ON "rcsa_assignment"
      USING ("org_id" = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- rcsa_response: org-scoped
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'rcsa_response_org_isolation') THEN
    CREATE POLICY "rcsa_response_org_isolation" ON "rcsa_response"
      USING ("org_id" = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- rcsa_result: org-scoped
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'rcsa_result_org_isolation') THEN
    CREATE POLICY "rcsa_result_org_isolation" ON "rcsa_result"
      USING ("org_id" = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 248: Audit triggers on all 4 tables
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    CREATE TRIGGER "rcsa_campaign_audit" AFTER INSERT OR UPDATE OR DELETE ON "rcsa_campaign"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    CREATE TRIGGER "rcsa_assignment_audit" AFTER INSERT OR UPDATE OR DELETE ON "rcsa_assignment"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    CREATE TRIGGER "rcsa_response_audit" AFTER INSERT OR UPDATE OR DELETE ON "rcsa_response"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    CREATE TRIGGER "rcsa_result_audit" AFTER INSERT OR UPDATE OR DELETE ON "rcsa_result"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 249: Seed email templates for RCSA
-- ──────────────────────────────────────────────────────────────

INSERT INTO "notification_template" ("key", "name", "subject", "body", "channel")
VALUES
  ('rcsa_invitation', 'RCSA Campaign Invitation', 'RCSA Assessment: {{campaignName}}', 'You have been assigned {{assignmentCount}} item(s) to assess in the "{{campaignName}}" campaign. Deadline: {{deadline}}. Please complete your assessments at {{link}}.', 'both'),
  ('rcsa_reminder', 'RCSA Assessment Reminder', 'Reminder: RCSA "{{campaignName}}" due in {{daysRemaining}} day(s)', 'You have {{pendingCount}} pending assessment(s) for "{{campaignName}}". The deadline is {{deadline}}. Please complete your assessments at {{link}}.', 'both'),
  ('rcsa_escalation', 'RCSA Overdue Escalation', 'Overdue: RCSA "{{campaignName}}" has {{overdueCount}} overdue', '{{overdueCount}} assessment(s) in campaign "{{campaignName}}" are overdue. Participants: {{overdueParticipants}}. Please take action.', 'both')
ON CONFLICT ("key") DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 250: Seed work item type for RCSA
-- ──────────────────────────────────────────────────────────────

INSERT INTO "work_item_type" ("key", "label", "prefix", "module_key", "description")
VALUES
  ('rcsa_campaign', 'RCSA Campaign', 'RCSA', 'erm', 'Risk & Control Self-Assessment campaign')
ON CONFLICT ("key") DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 251: Composite indices for aggregation queries
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "ra_campaign_status_idx" ON "rcsa_assignment"("campaign_id", "status");
CREATE INDEX IF NOT EXISTS "ra_campaign_entity_type_idx" ON "rcsa_assignment"("campaign_id", "entity_type");
CREATE INDEX IF NOT EXISTS "rc_org_created_idx" ON "rcsa_campaign"("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "rr_resp_responded_idx" ON "rcsa_response"("responded_at");
