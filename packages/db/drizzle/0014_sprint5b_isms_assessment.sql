CREATE TYPE "public"."assessment_scope_type" AS ENUM('full', 'department', 'asset_group', 'custom');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('planning', 'in_progress', 'review', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."eval_result" AS ENUM('effective', 'partially_effective', 'ineffective', 'not_applicable', 'not_evaluated');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."risk_decision" AS ENUM('accept', 'mitigate', 'transfer', 'avoid', 'pending');--> statement-breakpoint
CREATE TYPE "public"."soa_applicability" AS ENUM('applicable', 'not_applicable', 'partially_applicable');--> statement-breakpoint
CREATE TYPE "public"."soa_implementation" AS ENUM('implemented', 'partially_implemented', 'planned', 'not_implemented');--> statement-breakpoint
CREATE TABLE "assessment_control_eval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"assessment_run_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"asset_id" uuid,
	"result" "eval_result" DEFAULT 'not_evaluated' NOT NULL,
	"evidence" text,
	"notes" text,
	"evidence_document_ids" uuid[] DEFAULT '{}',
	"current_maturity" integer,
	"target_maturity" integer,
	"assessed_by" uuid,
	"assessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_risk_eval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"assessment_run_id" uuid NOT NULL,
	"risk_scenario_id" uuid NOT NULL,
	"residual_likelihood" integer,
	"residual_impact" integer,
	"decision" "risk_decision" DEFAULT 'pending' NOT NULL,
	"justification" text,
	"evaluated_by" uuid,
	"evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"status" "assessment_status" DEFAULT 'planning' NOT NULL,
	"scope_type" "assessment_scope_type" DEFAULT 'full' NOT NULL,
	"scope_filter" jsonb,
	"framework" varchar(100) DEFAULT 'iso27001' NOT NULL,
	"period_start" date,
	"period_end" date,
	"lead_assessor_id" uuid,
	"completion_percentage" integer DEFAULT 0 NOT NULL,
	"completed_evaluations" integer DEFAULT 0 NOT NULL,
	"total_evaluations" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "control_maturity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"assessment_run_id" uuid,
	"current_maturity" integer NOT NULL,
	"target_maturity" integer NOT NULL,
	"justification" text,
	"assessed_by" uuid,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cm_control_run_uniq" UNIQUE("control_id","assessment_run_id")
);
--> statement-breakpoint
CREATE TABLE "management_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"review_date" date NOT NULL,
	"status" "review_status" DEFAULT 'planned' NOT NULL,
	"chair_id" uuid,
	"participant_ids" uuid[] DEFAULT '{}',
	"changes_in_context" text,
	"performance_feedback" text,
	"risk_assessment_results" text,
	"audit_results" text,
	"improvement_opportunities" text,
	"decisions" jsonb,
	"action_items" jsonb,
	"minutes" text,
	"next_review_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "soa_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"catalog_entry_id" uuid NOT NULL,
	"control_id" uuid,
	"applicability" "soa_applicability" DEFAULT 'applicable' NOT NULL,
	"applicability_justification" text,
	"implementation" "soa_implementation" DEFAULT 'not_implemented' NOT NULL,
	"implementation_notes" text,
	"responsible_id" uuid,
	"last_reviewed" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "soa_org_catalog_uniq" UNIQUE("org_id","catalog_entry_id")
);
--> statement-breakpoint
ALTER TABLE "assessment_control_eval" ADD CONSTRAINT "assessment_control_eval_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_control_eval" ADD CONSTRAINT "assessment_control_eval_assessment_run_id_assessment_run_id_fk" FOREIGN KEY ("assessment_run_id") REFERENCES "public"."assessment_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_control_eval" ADD CONSTRAINT "assessment_control_eval_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_control_eval" ADD CONSTRAINT "assessment_control_eval_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_control_eval" ADD CONSTRAINT "assessment_control_eval_assessed_by_user_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_risk_eval" ADD CONSTRAINT "assessment_risk_eval_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_risk_eval" ADD CONSTRAINT "assessment_risk_eval_assessment_run_id_assessment_run_id_fk" FOREIGN KEY ("assessment_run_id") REFERENCES "public"."assessment_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_risk_eval" ADD CONSTRAINT "assessment_risk_eval_risk_scenario_id_risk_scenario_id_fk" FOREIGN KEY ("risk_scenario_id") REFERENCES "public"."risk_scenario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_risk_eval" ADD CONSTRAINT "assessment_risk_eval_evaluated_by_user_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_run" ADD CONSTRAINT "assessment_run_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_run" ADD CONSTRAINT "assessment_run_lead_assessor_id_user_id_fk" FOREIGN KEY ("lead_assessor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_run" ADD CONSTRAINT "assessment_run_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_maturity" ADD CONSTRAINT "control_maturity_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_maturity" ADD CONSTRAINT "control_maturity_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_maturity" ADD CONSTRAINT "control_maturity_assessment_run_id_assessment_run_id_fk" FOREIGN KEY ("assessment_run_id") REFERENCES "public"."assessment_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_maturity" ADD CONSTRAINT "control_maturity_assessed_by_user_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_review" ADD CONSTRAINT "management_review_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_review" ADD CONSTRAINT "management_review_chair_id_user_id_fk" FOREIGN KEY ("chair_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_review" ADD CONSTRAINT "management_review_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soa_entry" ADD CONSTRAINT "soa_entry_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soa_entry" ADD CONSTRAINT "soa_entry_catalog_entry_id_control_catalog_entry_id_fk" FOREIGN KEY ("catalog_entry_id") REFERENCES "public"."control_catalog_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soa_entry" ADD CONSTRAINT "soa_entry_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soa_entry" ADD CONSTRAINT "soa_entry_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ace_org_idx" ON "assessment_control_eval" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ace_run_idx" ON "assessment_control_eval" USING btree ("assessment_run_id");--> statement-breakpoint
CREATE INDEX "ace_control_idx" ON "assessment_control_eval" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "ace_asset_idx" ON "assessment_control_eval" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "are_org_idx" ON "assessment_risk_eval" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "are_run_idx" ON "assessment_risk_eval" USING btree ("assessment_run_id");--> statement-breakpoint
CREATE INDEX "are_scenario_idx" ON "assessment_risk_eval" USING btree ("risk_scenario_id");--> statement-breakpoint
CREATE INDEX "ar_org_idx" ON "assessment_run" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ar_status_idx" ON "assessment_run" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ar_lead_idx" ON "assessment_run" USING btree ("lead_assessor_id");--> statement-breakpoint
CREATE INDEX "cm_org_idx" ON "control_maturity" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "cm_control_idx" ON "control_maturity" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "cm_run_idx" ON "control_maturity" USING btree ("assessment_run_id");--> statement-breakpoint
CREATE INDEX "mr_org_idx" ON "management_review" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "mr_status_idx" ON "management_review" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "mr_date_idx" ON "management_review" USING btree ("org_id","review_date");--> statement-breakpoint
CREATE INDEX "soa_org_idx" ON "soa_entry" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "soa_catalog_idx" ON "soa_entry" USING btree ("catalog_entry_id");--> statement-breakpoint
CREATE INDEX "soa_control_idx" ON "soa_entry" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "soa_applicability_idx" ON "soa_entry" USING btree ("org_id","applicability");