CREATE TYPE "public"."dd_session_status" AS ENUM('invited', 'in_progress', 'submitted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('single_choice', 'multi_choice', 'text', 'yes_no', 'number', 'date', 'file_upload');--> statement-breakpoint
CREATE TYPE "public"."questionnaire_template_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "dd_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid,
	"file_name" varchar(500) NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" varchar(100) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"virus_scan_status" varchar(20) DEFAULT 'pending',
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dd_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text,
	"answer_choice" text[],
	"answer_number" numeric(15, 4),
	"answer_date" date,
	"answer_boolean" boolean,
	"score" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dd_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"due_diligence_id" uuid,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"access_token" varchar(128) NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"token_used_at" timestamp with time zone,
	"status" "dd_session_status" DEFAULT 'invited' NOT NULL,
	"language" varchar(2) DEFAULT 'de' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"total_score" integer,
	"max_possible_score" integer,
	"submitted_at" timestamp with time zone,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"supplier_email" varchar(320) NOT NULL,
	"supplier_name" varchar(500),
	"ip_address_log" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "dd_session_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "questionnaire_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"question_type" "question_type" NOT NULL,
	"question_de" text NOT NULL,
	"question_en" text NOT NULL,
	"help_text_de" text,
	"help_text_en" text,
	"options" jsonb DEFAULT '[]',
	"is_required" boolean DEFAULT true NOT NULL,
	"is_evidence_required" boolean DEFAULT false NOT NULL,
	"conditional_on" jsonb,
	"weight" numeric(5, 2) DEFAULT '1.0',
	"max_score" integer DEFAULT 0,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questionnaire_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"title_de" varchar(500) NOT NULL,
	"title_en" varchar(500) NOT NULL,
	"description_de" text,
	"description_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"weight" numeric(5, 2) DEFAULT '1.0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questionnaire_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "questionnaire_template_status" DEFAULT 'draft' NOT NULL,
	"target_tier" varchar(50),
	"target_topics" text[],
	"scoring_model" jsonb DEFAULT '{}',
	"is_default" boolean DEFAULT false NOT NULL,
	"total_max_score" integer DEFAULT 0,
	"estimated_minutes" integer DEFAULT 30,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dd_evidence" ADD CONSTRAINT "dd_evidence_session_id_dd_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dd_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_evidence" ADD CONSTRAINT "dd_evidence_question_id_questionnaire_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questionnaire_question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_response" ADD CONSTRAINT "dd_response_session_id_dd_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dd_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_response" ADD CONSTRAINT "dd_response_question_id_questionnaire_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questionnaire_question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_session" ADD CONSTRAINT "dd_session_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_session" ADD CONSTRAINT "dd_session_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_session" ADD CONSTRAINT "dd_session_due_diligence_id_vendor_due_diligence_id_fk" FOREIGN KEY ("due_diligence_id") REFERENCES "public"."vendor_due_diligence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_session" ADD CONSTRAINT "dd_session_template_id_questionnaire_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."questionnaire_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_session" ADD CONSTRAINT "dd_session_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_question" ADD CONSTRAINT "questionnaire_question_section_id_questionnaire_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."questionnaire_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_section" ADD CONSTRAINT "questionnaire_section_template_id_questionnaire_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."questionnaire_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_template" ADD CONSTRAINT "questionnaire_template_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_template" ADD CONSTRAINT "questionnaire_template_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dde_session_idx" ON "dd_evidence" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ddr_session_idx" ON "dd_response" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ddr_session_question_idx" ON "dd_response" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE INDEX "dds_token_idx" ON "dd_session" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "dds_vendor_idx" ON "dd_session" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "dds_org_idx" ON "dd_session" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "dds_status_idx" ON "dd_session" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "dds_expiry_idx" ON "dd_session" USING btree ("token_expires_at");--> statement-breakpoint
CREATE INDEX "qq_section_idx" ON "questionnaire_question" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "qs_template_idx" ON "questionnaire_section" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "qt_org_idx" ON "questionnaire_template" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "qt_status_idx" ON "questionnaire_template" USING btree ("org_id","status");