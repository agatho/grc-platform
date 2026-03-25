CREATE TABLE "process_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"entity_type" varchar(50) DEFAULT 'process' NOT NULL,
	"entity_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"parent_comment_id" uuid,
	"mentioned_user_ids" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "process_review_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"review_interval_months" integer DEFAULT 12 NOT NULL,
	"next_review_date" date NOT NULL,
	"last_reminder_sent_at" timestamp with time zone,
	"assigned_reviewer_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "process" ADD COLUMN "gallery_thumbnail_path" varchar(1000);--> statement-breakpoint
ALTER TABLE "process_version" ADD COLUMN "diff_summary_json" jsonb;--> statement-breakpoint
ALTER TABLE "process_comment" ADD CONSTRAINT "process_comment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_comment" ADD CONSTRAINT "process_comment_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_comment" ADD CONSTRAINT "process_comment_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_comment" ADD CONSTRAINT "process_comment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_review_schedule" ADD CONSTRAINT "process_review_schedule_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_review_schedule" ADD CONSTRAINT "process_review_schedule_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_review_schedule" ADD CONSTRAINT "process_review_schedule_assigned_reviewer_id_user_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_review_schedule" ADD CONSTRAINT "process_review_schedule_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pc_org_idx" ON "process_comment" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "pc_process_idx" ON "process_comment" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "pc_entity_idx" ON "process_comment" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "pc_parent_idx" ON "process_comment" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "prs_org_idx" ON "process_review_schedule" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "prs_next_review_idx" ON "process_review_schedule" USING btree ("next_review_date");--> statement-breakpoint

-- ============================================================
-- CUSTOM SQL: Sprint 3b — Process Governance Constraints, Triggers, RLS
-- Tables: process_review_schedule, process_comment
-- ============================================================

-- ─── 1. UNIQUE CONSTRAINT: one review schedule per process ───

ALTER TABLE "process_review_schedule" ADD CONSTRAINT "prs_process_id_unique"
  UNIQUE ("process_id");--> statement-breakpoint

-- ─── 2. CHECK CONSTRAINT: review_interval_months (1-60) ─────

ALTER TABLE "process_review_schedule" ADD CONSTRAINT "prs_interval_range"
  CHECK (review_interval_months BETWEEN 1 AND 60);--> statement-breakpoint

-- ─── 3. set_updated_at TRIGGERS ──────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "process_review_schedule"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "process_comment"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ─── 4. ROW-LEVEL SECURITY (ADR-001) ────────────────────────

ALTER TABLE "process_review_schedule" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "process_comment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- org_isolation policies
CREATE POLICY org_isolation ON "process_review_schedule"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "process_comment"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

-- reporting_bypass policies (for cross-org reporting)
CREATE POLICY reporting_bypass ON "process_review_schedule"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "process_comment"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

-- ─── 5. AUDIT TRIGGERS (ADR-011) ────────────────────────────

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "process_review_schedule"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "process_comment"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();