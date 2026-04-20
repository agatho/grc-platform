-- Sprint 17: Compliance Calendar
-- Migration 271-276: Manual events table, iCal token, RLS, Audit Triggers, Indices

-- ──────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────

CREATE TYPE "public"."calendar_event_type" AS ENUM('meeting', 'workshop', 'review', 'training', 'deadline', 'other');--> statement-breakpoint
CREATE TYPE "public"."calendar_recurrence" AS ENUM('none', 'weekly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 271: compliance_calendar_event (manual events only)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "compliance_calendar_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "title" varchar(500) NOT NULL,
  "description" text,
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz,
  "is_all_day" boolean NOT NULL DEFAULT false,
  "event_type" "calendar_event_type" NOT NULL,
  "module" varchar(20),
  "recurrence" "calendar_recurrence" NOT NULL DEFAULT 'none',
  "recurrence_end_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "user"("id"),
  "updated_by" uuid,
  "deleted_at" timestamptz,
  "deleted_by" uuid
);--> statement-breakpoint

CREATE INDEX "cce_org_idx" ON "compliance_calendar_event" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "cce_date_idx" ON "compliance_calendar_event" USING btree ("org_id", "start_at");--> statement-breakpoint
CREATE INDEX "cce_type_idx" ON "compliance_calendar_event" USING btree ("org_id", "event_type");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 272: ALTER user — Add iCal token fields
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "user" ADD COLUMN "ical_token" varchar(128);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ical_token_created_at" timestamptz;--> statement-breakpoint

CREATE UNIQUE INDEX "user_ical_token_idx" ON "user" USING btree ("ical_token") WHERE "ical_token" IS NOT NULL;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 273: RLS on compliance_calendar_event
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "compliance_calendar_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "cce_org_isolation" ON "compliance_calendar_event"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

CREATE POLICY "cce_insert_policy" ON "compliance_calendar_event"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 274: Audit trigger on compliance_calendar_event
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER "compliance_calendar_event_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "compliance_calendar_event"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 275: Performance indices on source tables for calendar aggregation
-- These indices accelerate the UNION ALL query across 10+ tables
-- ──────────────────────────────────────────────────────────────

-- Audit: planned_start for calendar view
CREATE INDEX IF NOT EXISTS "audit_calendar_date_idx" ON "audit" USING btree ("org_id", "planned_start");--> statement-breakpoint

-- Control test: test_date for calendar view
CREATE INDEX IF NOT EXISTS "ct_calendar_date_idx" ON "control_test" USING btree ("org_id", "test_date");--> statement-breakpoint

-- Contract: expiration_date for calendar view
CREATE INDEX IF NOT EXISTS "contract_calendar_expiry_idx" ON "contract" USING btree ("org_id", "expiration_date");--> statement-breakpoint

-- RoPA: next_review_date for calendar view
CREATE INDEX IF NOT EXISTS "ropa_calendar_review_idx" ON "ropa_entry" USING btree ("org_id", "next_review_date");--> statement-breakpoint

-- BC Exercise: planned_date for calendar view
CREATE INDEX IF NOT EXISTS "bce_calendar_date_idx" ON "bc_exercise" USING btree ("org_id", "planned_date");--> statement-breakpoint

-- ESG Annual Report: reporting_year for calendar view
CREATE INDEX IF NOT EXISTS "ear_calendar_year_idx" ON "esg_annual_report" USING btree ("org_id", "reporting_year");--> statement-breakpoint

-- RCSA Campaign: period_end for calendar view.
-- Skip gracefully if rcsa_campaign doesn't exist (its create migration was
-- dropped / renamed — Sprint 14 originally, now gated on table presence).
DO $BODY$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rcsa_campaign') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "rcsa_calendar_period_idx" ON "rcsa_campaign" USING btree ("org_id", "period_end")';
  END IF;
END
$BODY$;

-- Data Breach: detected_at + 72h deadline for calendar view
CREATE INDEX IF NOT EXISTS "breach_calendar_detected_idx" ON "data_breach" USING btree ("org_id", "detected_at");--> statement-breakpoint

-- Finding: remediation_due_date for calendar view
CREATE INDEX IF NOT EXISTS "finding_calendar_due_idx" ON "finding" USING btree ("org_id", "remediation_due_date");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 276: Seed email template for weekly calendar digest
-- ──────────────────────────────────────────────────────────────

INSERT INTO "notification" ("id", "org_id", "user_id", "type", "entity_type", "title", "message", "channel", "template_key", "created_at", "updated_at")
SELECT gen_random_uuid(), o.id, NULL, 'deadline_approaching', 'calendar_digest',
  'Weekly Compliance Calendar Digest', 'Template for weekly calendar email digest', 'email', 'calendar_weekly_digest',
  now(), now()
FROM "organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "notification" n WHERE n.template_key = 'calendar_weekly_digest' AND n.org_id = o.id
)
LIMIT 0;--> statement-breakpoint
