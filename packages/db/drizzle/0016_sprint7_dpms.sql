CREATE TYPE "public"."breach_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."breach_status" AS ENUM('detected', 'assessing', 'notifying_dpa', 'notifying_individuals', 'remediation', 'closed');--> statement-breakpoint
CREATE TYPE "public"."dpia_status" AS ENUM('draft', 'in_progress', 'completed', 'pending_dpo_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."dsr_status" AS ENUM('received', 'verified', 'processing', 'response_sent', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."dsr_type" AS ENUM('access', 'erasure', 'restriction', 'portability', 'objection');--> statement-breakpoint
CREATE TYPE "public"."ropa_legal_basis" AS ENUM('consent', 'contract', 'legal_obligation', 'vital_interest', 'public_interest', 'legitimate_interest');--> statement-breakpoint
CREATE TYPE "public"."ropa_status" AS ENUM('draft', 'active', 'under_review', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tia_legal_basis" AS ENUM('adequacy', 'sccs', 'bcrs', 'derogation');--> statement-breakpoint
CREATE TYPE "public"."tia_risk_rating" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "data_breach" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"incident_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"severity" "breach_severity" DEFAULT 'medium' NOT NULL,
	"status" "breach_status" DEFAULT 'detected' NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"dpa_notified_at" timestamp with time zone,
	"individuals_notified_at" timestamp with time zone,
	"is_dpa_notification_required" boolean DEFAULT true NOT NULL,
	"is_individual_notification_required" boolean DEFAULT false NOT NULL,
	"data_categories_affected" text[],
	"estimated_records_affected" integer,
	"affected_countries" text[],
	"containment_measures" text,
	"remediation_measures" text,
	"lessons_learned" text,
	"dpo_id" uuid,
	"assignee_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "data_breach_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"data_breach_id" uuid NOT NULL,
	"recipient_type" varchar(100) NOT NULL,
	"recipient_email" varchar(255),
	"sent_at" timestamp with time zone,
	"response_status" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"processing_description" text,
	"legal_basis" "ropa_legal_basis",
	"necessity_assessment" text,
	"dpo_consultation_required" boolean DEFAULT false NOT NULL,
	"status" "dpia_status" DEFAULT 'draft' NOT NULL,
	"residual_risk_sign_off_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dpia_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"dpia_id" uuid NOT NULL,
	"measure_description" text NOT NULL,
	"implementation_timeline" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpia_risk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"dpia_id" uuid NOT NULL,
	"risk_description" text NOT NULL,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"likelihood" varchar(20) DEFAULT 'medium' NOT NULL,
	"impact" varchar(20) DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"request_type" "dsr_type" NOT NULL,
	"status" "dsr_status" DEFAULT 'received' NOT NULL,
	"subject_name" varchar(255),
	"subject_email" varchar(255),
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"handler_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dsr_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"dsr_id" uuid NOT NULL,
	"activity_type" varchar(100) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"details" text,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ropa_data_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"ropa_entry_id" uuid NOT NULL,
	"category" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ropa_data_subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"ropa_entry_id" uuid NOT NULL,
	"subject_category" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ropa_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"purpose" text NOT NULL,
	"legal_basis" "ropa_legal_basis" NOT NULL,
	"legal_basis_detail" text,
	"controller_org_id" uuid,
	"processor_name" varchar(500),
	"processing_description" text,
	"retention_period" varchar(255),
	"retention_justification" text,
	"technical_measures" text,
	"organizational_measures" text,
	"international_transfer" boolean DEFAULT false NOT NULL,
	"transfer_country" varchar(100),
	"transfer_safeguard" varchar(100),
	"status" "ropa_status" DEFAULT 'draft' NOT NULL,
	"last_reviewed" timestamp with time zone,
	"next_review_date" date,
	"responsible_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ropa_recipient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"ropa_entry_id" uuid NOT NULL,
	"recipient_name" varchar(500) NOT NULL,
	"recipient_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"transfer_country" varchar(100) NOT NULL,
	"legal_basis" "tia_legal_basis" NOT NULL,
	"schrems_ii_assessment" text,
	"risk_rating" "tia_risk_rating" DEFAULT 'medium' NOT NULL,
	"supporting_documents" text,
	"responsible_id" uuid,
	"assessment_date" date,
	"next_review_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "data_breach" ADD CONSTRAINT "data_breach_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breach" ADD CONSTRAINT "data_breach_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breach" ADD CONSTRAINT "data_breach_incident_id_security_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."security_incident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breach" ADD CONSTRAINT "data_breach_dpo_id_user_id_fk" FOREIGN KEY ("dpo_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breach" ADD CONSTRAINT "data_breach_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breach" ADD CONSTRAINT "data_breach_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breach_notification" ADD CONSTRAINT "data_breach_notification_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breach_notification" ADD CONSTRAINT "data_breach_notification_data_breach_id_data_breach_id_fk" FOREIGN KEY ("data_breach_id") REFERENCES "public"."data_breach"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia" ADD CONSTRAINT "dpia_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia" ADD CONSTRAINT "dpia_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia" ADD CONSTRAINT "dpia_residual_risk_sign_off_id_user_id_fk" FOREIGN KEY ("residual_risk_sign_off_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia" ADD CONSTRAINT "dpia_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_measure" ADD CONSTRAINT "dpia_measure_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_measure" ADD CONSTRAINT "dpia_measure_dpia_id_dpia_id_fk" FOREIGN KEY ("dpia_id") REFERENCES "public"."dpia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_risk" ADD CONSTRAINT "dpia_risk_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_risk" ADD CONSTRAINT "dpia_risk_dpia_id_dpia_id_fk" FOREIGN KEY ("dpia_id") REFERENCES "public"."dpia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsr" ADD CONSTRAINT "dsr_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsr" ADD CONSTRAINT "dsr_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsr" ADD CONSTRAINT "dsr_handler_id_user_id_fk" FOREIGN KEY ("handler_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsr" ADD CONSTRAINT "dsr_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsr_activity" ADD CONSTRAINT "dsr_activity_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsr_activity" ADD CONSTRAINT "dsr_activity_dsr_id_dsr_id_fk" FOREIGN KEY ("dsr_id") REFERENCES "public"."dsr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsr_activity" ADD CONSTRAINT "dsr_activity_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_data_category" ADD CONSTRAINT "ropa_data_category_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_data_category" ADD CONSTRAINT "ropa_data_category_ropa_entry_id_ropa_entry_id_fk" FOREIGN KEY ("ropa_entry_id") REFERENCES "public"."ropa_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_data_subject" ADD CONSTRAINT "ropa_data_subject_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_data_subject" ADD CONSTRAINT "ropa_data_subject_ropa_entry_id_ropa_entry_id_fk" FOREIGN KEY ("ropa_entry_id") REFERENCES "public"."ropa_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_entry" ADD CONSTRAINT "ropa_entry_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_entry" ADD CONSTRAINT "ropa_entry_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_entry" ADD CONSTRAINT "ropa_entry_controller_org_id_organization_id_fk" FOREIGN KEY ("controller_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_entry" ADD CONSTRAINT "ropa_entry_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_entry" ADD CONSTRAINT "ropa_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_recipient" ADD CONSTRAINT "ropa_recipient_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_recipient" ADD CONSTRAINT "ropa_recipient_ropa_entry_id_ropa_entry_id_fk" FOREIGN KEY ("ropa_entry_id") REFERENCES "public"."ropa_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tia" ADD CONSTRAINT "tia_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tia" ADD CONSTRAINT "tia_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tia" ADD CONSTRAINT "tia_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tia" ADD CONSTRAINT "tia_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "db_org_idx" ON "data_breach" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "db_status_idx" ON "data_breach" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "db_severity_idx" ON "data_breach" USING btree ("org_id","severity");--> statement-breakpoint
CREATE INDEX "db_incident_idx" ON "data_breach" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "db_dpo_idx" ON "data_breach" USING btree ("dpo_id");--> statement-breakpoint
CREATE INDEX "dbn_org_idx" ON "data_breach_notification" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "dbn_breach_idx" ON "data_breach_notification" USING btree ("data_breach_id");--> statement-breakpoint
CREATE INDEX "dpia_org_idx" ON "dpia" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "dpia_status_idx" ON "dpia" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "dpia_measure_org_idx" ON "dpia_measure" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "dpia_measure_dpia_idx" ON "dpia_measure" USING btree ("dpia_id");--> statement-breakpoint
CREATE INDEX "dpia_risk_org_idx" ON "dpia_risk" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "dpia_risk_dpia_idx" ON "dpia_risk" USING btree ("dpia_id");--> statement-breakpoint
CREATE INDEX "dsr_org_idx" ON "dsr" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "dsr_status_idx" ON "dsr" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "dsr_handler_idx" ON "dsr" USING btree ("handler_id");--> statement-breakpoint
CREATE INDEX "dsr_deadline_idx" ON "dsr" USING btree ("org_id","deadline");--> statement-breakpoint
CREATE INDEX "dsr_act_org_idx" ON "dsr_activity" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "dsr_act_dsr_idx" ON "dsr_activity" USING btree ("dsr_id");--> statement-breakpoint
CREATE INDEX "rdc_org_idx" ON "ropa_data_category" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rdc_ropa_idx" ON "ropa_data_category" USING btree ("ropa_entry_id");--> statement-breakpoint
CREATE INDEX "rds_org_idx" ON "ropa_data_subject" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rds_ropa_idx" ON "ropa_data_subject" USING btree ("ropa_entry_id");--> statement-breakpoint
CREATE INDEX "ropa_org_idx" ON "ropa_entry" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ropa_status_idx" ON "ropa_entry" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ropa_responsible_idx" ON "ropa_entry" USING btree ("responsible_id");--> statement-breakpoint
CREATE INDEX "rr_org_idx" ON "ropa_recipient" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rr_ropa_idx" ON "ropa_recipient" USING btree ("ropa_entry_id");--> statement-breakpoint
CREATE INDEX "tia_org_idx" ON "tia" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "tia_country_idx" ON "tia" USING btree ("org_id","transfer_country");--> statement-breakpoint
CREATE INDEX "tia_risk_idx" ON "tia" USING btree ("org_id","risk_rating");