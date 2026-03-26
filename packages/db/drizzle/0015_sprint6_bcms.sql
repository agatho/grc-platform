CREATE TYPE "public"."bcp_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'archived', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."bia_status" AS ENUM('draft', 'in_progress', 'review', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."crisis_severity" AS ENUM('level_1_incident', 'level_2_emergency', 'level_3_crisis', 'level_4_catastrophe');--> statement-breakpoint
CREATE TYPE "public"."crisis_status" AS ENUM('standby', 'activated', 'resolved', 'post_mortem');--> statement-breakpoint
CREATE TYPE "public"."exercise_status" AS ENUM('planned', 'preparation', 'executing', 'evaluation', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."exercise_type" AS ENUM('tabletop', 'walkthrough', 'functional', 'full_simulation');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('people', 'it_system', 'facility', 'supplier', 'equipment', 'data', 'other');--> statement-breakpoint
CREATE TYPE "public"."strategy_type" AS ENUM('active_active', 'active_passive', 'cold_standby', 'manual_workaround', 'outsource', 'do_nothing');--> statement-breakpoint
CREATE TABLE "bc_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"exercise_type" "exercise_type" NOT NULL,
	"status" "exercise_status" DEFAULT 'planned' NOT NULL,
	"crisis_scenario_id" uuid,
	"bcp_id" uuid,
	"planned_date" date NOT NULL,
	"planned_duration_hours" integer,
	"actual_date" date,
	"actual_duration_hours" integer,
	"exercise_lead_id" uuid,
	"participant_ids" uuid[] DEFAULT '{}',
	"observer_ids" uuid[] DEFAULT '{}',
	"objectives" jsonb DEFAULT '[]'::jsonb,
	"lessons_learned" text,
	"overall_result" varchar(50),
	"report_document_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bc_exercise_finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"finding_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"severity" varchar(20) NOT NULL,
	"recommendation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bcp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" "bcp_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"scope" text,
	"process_ids" uuid[] DEFAULT '{}',
	"bc_manager_id" uuid,
	"deputy_manager_id" uuid,
	"activation_criteria" text,
	"activation_authority" varchar(255),
	"report_document_id" uuid,
	"last_tested_date" date,
	"next_review_date" date,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bcp_procedure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bcp_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"responsible_role" varchar(255),
	"responsible_id" uuid,
	"estimated_duration_minutes" integer,
	"required_resources" text,
	"prerequisites" text,
	"success_criteria" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bcp_resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bcp_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1,
	"asset_id" uuid,
	"is_available_offsite" boolean DEFAULT false NOT NULL,
	"alternative_resource" varchar(500),
	"priority" varchar(20) DEFAULT 'required',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bia_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"status" "bia_status" DEFAULT 'draft' NOT NULL,
	"period_start" date,
	"period_end" date,
	"lead_assessor_id" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bia_process_impact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"bia_assessment_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"mtpd_hours" integer,
	"rto_hours" integer,
	"rpo_hours" integer,
	"impact_1h" numeric(15, 2),
	"impact_4h" numeric(15, 2),
	"impact_24h" numeric(15, 2),
	"impact_72h" numeric(15, 2),
	"impact_1w" numeric(15, 2),
	"impact_1m" numeric(15, 2),
	"impact_reputation" integer,
	"impact_legal" integer,
	"impact_operational" integer,
	"impact_financial" integer,
	"impact_safety" integer,
	"critical_resources" text,
	"minimum_staff" integer,
	"alternate_location" varchar(500),
	"peak_periods" text,
	"dependencies_json" jsonb DEFAULT '{}'::jsonb,
	"priority_ranking" integer,
	"is_essential" boolean DEFAULT false NOT NULL,
	"assessed_by" uuid,
	"assessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bia_supplier_dependency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bia_process_impact_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"supplier_name" varchar(500) NOT NULL,
	"vendor_id" uuid,
	"service" varchar(500),
	"is_critical" boolean DEFAULT false NOT NULL,
	"alternative_available" boolean DEFAULT false NOT NULL,
	"switchover_time_hours" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "continuity_strategy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"strategy_type" "strategy_type" NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"rto_target_hours" integer NOT NULL,
	"rto_actual_hours" integer,
	"estimated_cost_eur" numeric(15, 2),
	"annual_cost_eur" numeric(15, 2),
	"required_staff" integer,
	"required_systems" text,
	"alternate_location" varchar(500),
	"is_active" boolean DEFAULT false NOT NULL,
	"last_tested_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crisis_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crisis_scenario_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"entry_type" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crisis_scenario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"severity" "crisis_severity" DEFAULT 'level_2_emergency' NOT NULL,
	"status" "crisis_status" DEFAULT 'standby' NOT NULL,
	"escalation_matrix" jsonb DEFAULT '[]'::jsonb,
	"communication_template" text,
	"bcp_id" uuid,
	"activated_at" timestamp with time zone,
	"activated_by" uuid,
	"resolved_at" timestamp with time zone,
	"post_mortem_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crisis_team_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crisis_scenario_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(100) NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"deputy_user_id" uuid,
	"phone_number" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essential_process" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"bia_assessment_id" uuid,
	"priority_ranking" integer NOT NULL,
	"mtpd_hours" integer NOT NULL,
	"rto_hours" integer NOT NULL,
	"justification" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bc_exercise" ADD CONSTRAINT "bc_exercise_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise" ADD CONSTRAINT "bc_exercise_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise" ADD CONSTRAINT "bc_exercise_crisis_scenario_id_crisis_scenario_id_fk" FOREIGN KEY ("crisis_scenario_id") REFERENCES "public"."crisis_scenario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise" ADD CONSTRAINT "bc_exercise_bcp_id_bcp_id_fk" FOREIGN KEY ("bcp_id") REFERENCES "public"."bcp"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise" ADD CONSTRAINT "bc_exercise_exercise_lead_id_user_id_fk" FOREIGN KEY ("exercise_lead_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise" ADD CONSTRAINT "bc_exercise_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise_finding" ADD CONSTRAINT "bc_exercise_finding_exercise_id_bc_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."bc_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise_finding" ADD CONSTRAINT "bc_exercise_finding_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise_finding" ADD CONSTRAINT "bc_exercise_finding_finding_id_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."finding"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bc_exercise_finding" ADD CONSTRAINT "bc_exercise_finding_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp" ADD CONSTRAINT "bcp_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp" ADD CONSTRAINT "bcp_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp" ADD CONSTRAINT "bcp_bc_manager_id_user_id_fk" FOREIGN KEY ("bc_manager_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp" ADD CONSTRAINT "bcp_deputy_manager_id_user_id_fk" FOREIGN KEY ("deputy_manager_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp" ADD CONSTRAINT "bcp_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp" ADD CONSTRAINT "bcp_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp_procedure" ADD CONSTRAINT "bcp_procedure_bcp_id_bcp_id_fk" FOREIGN KEY ("bcp_id") REFERENCES "public"."bcp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp_procedure" ADD CONSTRAINT "bcp_procedure_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp_procedure" ADD CONSTRAINT "bcp_procedure_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp_resource" ADD CONSTRAINT "bcp_resource_bcp_id_bcp_id_fk" FOREIGN KEY ("bcp_id") REFERENCES "public"."bcp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp_resource" ADD CONSTRAINT "bcp_resource_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bcp_resource" ADD CONSTRAINT "bcp_resource_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_assessment" ADD CONSTRAINT "bia_assessment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_assessment" ADD CONSTRAINT "bia_assessment_lead_assessor_id_user_id_fk" FOREIGN KEY ("lead_assessor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_assessment" ADD CONSTRAINT "bia_assessment_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_assessment" ADD CONSTRAINT "bia_assessment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_process_impact" ADD CONSTRAINT "bia_process_impact_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_process_impact" ADD CONSTRAINT "bia_process_impact_bia_assessment_id_bia_assessment_id_fk" FOREIGN KEY ("bia_assessment_id") REFERENCES "public"."bia_assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_process_impact" ADD CONSTRAINT "bia_process_impact_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_process_impact" ADD CONSTRAINT "bia_process_impact_assessed_by_user_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_supplier_dependency" ADD CONSTRAINT "bia_supplier_dependency_bia_process_impact_id_bia_process_impact_id_fk" FOREIGN KEY ("bia_process_impact_id") REFERENCES "public"."bia_process_impact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bia_supplier_dependency" ADD CONSTRAINT "bia_supplier_dependency_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continuity_strategy" ADD CONSTRAINT "continuity_strategy_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continuity_strategy" ADD CONSTRAINT "continuity_strategy_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continuity_strategy" ADD CONSTRAINT "continuity_strategy_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_log" ADD CONSTRAINT "crisis_log_crisis_scenario_id_crisis_scenario_id_fk" FOREIGN KEY ("crisis_scenario_id") REFERENCES "public"."crisis_scenario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_log" ADD CONSTRAINT "crisis_log_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_log" ADD CONSTRAINT "crisis_log_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_scenario" ADD CONSTRAINT "crisis_scenario_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_scenario" ADD CONSTRAINT "crisis_scenario_bcp_id_bcp_id_fk" FOREIGN KEY ("bcp_id") REFERENCES "public"."bcp"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_scenario" ADD CONSTRAINT "crisis_scenario_activated_by_user_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_scenario" ADD CONSTRAINT "crisis_scenario_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_team_member" ADD CONSTRAINT "crisis_team_member_crisis_scenario_id_crisis_scenario_id_fk" FOREIGN KEY ("crisis_scenario_id") REFERENCES "public"."crisis_scenario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_team_member" ADD CONSTRAINT "crisis_team_member_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_team_member" ADD CONSTRAINT "crisis_team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crisis_team_member" ADD CONSTRAINT "crisis_team_member_deputy_user_id_user_id_fk" FOREIGN KEY ("deputy_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essential_process" ADD CONSTRAINT "essential_process_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essential_process" ADD CONSTRAINT "essential_process_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essential_process" ADD CONSTRAINT "essential_process_bia_assessment_id_bia_assessment_id_fk" FOREIGN KEY ("bia_assessment_id") REFERENCES "public"."bia_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bcp_org_idx" ON "bcp" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "bcp_status_idx" ON "bcp" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "bcp_proc_bcp_idx" ON "bcp_procedure" USING btree ("bcp_id");--> statement-breakpoint
CREATE INDEX "bcp_proc_order_idx" ON "bcp_procedure" USING btree ("bcp_id","step_number");--> statement-breakpoint
CREATE INDEX "bia_org_idx" ON "bia_assessment" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "bpi_bia_idx" ON "bia_process_impact" USING btree ("bia_assessment_id");--> statement-breakpoint
CREATE INDEX "bpi_process_idx" ON "bia_process_impact" USING btree ("process_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bpi_unique" ON "bia_process_impact" USING btree ("bia_assessment_id","process_id");--> statement-breakpoint
CREATE INDEX "cs_process_idx" ON "continuity_strategy" USING btree ("process_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ep_unique_process" ON "essential_process" USING btree ("org_id","process_id");