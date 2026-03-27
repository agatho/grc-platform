CREATE TYPE "public"."budget_status" AS ENUM('draft', 'submitted', 'approved');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('personnel', 'external', 'tools', 'training', 'measures', 'certification');--> statement-breakpoint
CREATE TYPE "public"."cost_type" AS ENUM('planned', 'actual', 'forecast');--> statement-breakpoint
CREATE TYPE "public"."grc_area" AS ENUM('erm', 'isms', 'ics', 'dpms', 'audit', 'tprm', 'bcms', 'esg', 'general');--> statement-breakpoint
CREATE TYPE "public"."roi_method" AS ENUM('ale_reduction', 'penalty_avoidance', 'incident_prevention', 'roni');--> statement-breakpoint
CREATE TABLE "grc_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"status" "budget_status" DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_budget_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"grc_area" "grc_area" NOT NULL,
	"cost_category" "cost_category" NOT NULL,
	"planned_amount" numeric(15, 2) NOT NULL,
	"q1_amount" numeric(15, 2),
	"q2_amount" numeric(15, 2),
	"q3_amount" numeric(15, 2),
	"q4_amount" numeric(15, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_cost_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"cost_category" "cost_category" NOT NULL,
	"cost_type" "cost_type" DEFAULT 'actual' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"department" varchar(200),
	"hours" numeric(8, 2),
	"hourly_rate" numeric(8, 2),
	"description" text,
	"budget_id" uuid,
	"invoice_ref" varchar(200),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_roi_calculation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"investment_cost" numeric(15, 2),
	"risk_reduction_value" numeric(15, 2),
	"roi_percent" numeric(10, 2),
	"roni_cfo" numeric(15, 2),
	"roni_ciso" numeric(15, 2),
	"inherent_ale" numeric(15, 2),
	"residual_ale" numeric(15, 2),
	"calculation_method" "roi_method",
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_time_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"grc_area" "grc_area" NOT NULL,
	"department" varchar(200),
	"hours" numeric(6, 2) NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grc_budget" ADD CONSTRAINT "grc_budget_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_budget" ADD CONSTRAINT "grc_budget_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_budget" ADD CONSTRAINT "grc_budget_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_budget_line" ADD CONSTRAINT "grc_budget_line_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_budget_line" ADD CONSTRAINT "grc_budget_line_budget_id_grc_budget_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."grc_budget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_cost_entry" ADD CONSTRAINT "grc_cost_entry_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_cost_entry" ADD CONSTRAINT "grc_cost_entry_budget_id_grc_budget_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."grc_budget"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_cost_entry" ADD CONSTRAINT "grc_cost_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_roi_calculation" ADD CONSTRAINT "grc_roi_calculation_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_time_entry" ADD CONSTRAINT "grc_time_entry_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_time_entry" ADD CONSTRAINT "grc_time_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_time_entry" ADD CONSTRAINT "grc_time_entry_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gb_org_year_idx" ON "grc_budget" USING btree ("org_id","year");--> statement-breakpoint
CREATE INDEX "gbl_budget_idx" ON "grc_budget_line" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "gbl_org_idx" ON "grc_budget_line" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "gce_org_idx" ON "grc_cost_entry" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "gce_entity_idx" ON "grc_cost_entry" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "gce_period_idx" ON "grc_cost_entry" USING btree ("org_id","period_start");--> statement-breakpoint
CREATE INDEX "gce_category_idx" ON "grc_cost_entry" USING btree ("org_id","cost_category");--> statement-breakpoint
CREATE INDEX "groi_org_idx" ON "grc_roi_calculation" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "groi_entity_idx" ON "grc_roi_calculation" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "gte_org_idx" ON "grc_time_entry" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "gte_user_idx" ON "grc_time_entry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gte_date_idx" ON "grc_time_entry" USING btree ("org_id","date");--> statement-breakpoint

-- ─── RLS on all 5 budget/cost/ROI tables ────────────────────
ALTER TABLE "grc_budget" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "grc_budget_line" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "grc_cost_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "grc_time_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "grc_roi_calculation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- RLS Policies (org_id isolation)
CREATE POLICY "grc_budget_org_isolation" ON "grc_budget"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "grc_budget_line_org_isolation" ON "grc_budget_line"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "grc_cost_entry_org_isolation" ON "grc_cost_entry"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "grc_time_entry_org_isolation" ON "grc_time_entry"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "grc_roi_calculation_org_isolation" ON "grc_roi_calculation"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

-- ─── set_updated_at TRIGGERS ────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "grc_budget"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ─── Audit log triggers ─────────────────────────────────────
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "grc_budget"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "grc_budget_line"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "grc_cost_entry"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "grc_time_entry"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "grc_roi_calculation"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

-- ─── Seed default budget categories ─────────────────────────
-- No seed data needed in migration; budget lines are created via API.
-- The enum values (grc_area, cost_category) serve as the category catalog.