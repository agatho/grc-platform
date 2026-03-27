CREATE TYPE "public"."wb_case_status" AS ENUM('received', 'acknowledged', 'investigating', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."wb_category" AS ENUM('fraud', 'corruption', 'discrimination', 'privacy', 'environmental', 'health_safety', 'other');--> statement-breakpoint
CREATE TYPE "public"."wb_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."wb_resolution_category" AS ENUM('substantiated', 'unsubstantiated', 'inconclusive', 'referred');--> statement-breakpoint
CREATE TABLE "wb_anonymous_mailbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"token" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "wb_anonymous_mailbox_report_id_unique" UNIQUE("report_id"),
	CONSTRAINT "wb_anonymous_mailbox_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "wb_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"case_number" varchar(20) NOT NULL,
	"status" "wb_case_status" DEFAULT 'received' NOT NULL,
	"priority" "wb_priority" DEFAULT 'medium',
	"assigned_to" uuid,
	"acknowledged_at" timestamp with time zone,
	"acknowledge_deadline" timestamp with time zone NOT NULL,
	"response_deadline" timestamp with time zone NOT NULL,
	"resolution" text,
	"resolution_category" "wb_resolution_category",
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "wb_case_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "wb_case_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"report_id" uuid,
	"org_id" uuid NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"sha256_hash" varchar(64) NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_immutable" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wb_case_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"author_type" varchar(20) NOT NULL,
	"author_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wb_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"report_token" varchar(128) NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"category" "wb_category" NOT NULL,
	"description" text NOT NULL,
	"contact_email" varchar(320),
	"language" varchar(2) DEFAULT 'de' NOT NULL,
	"ip_hash" varchar(64),
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wb_report_report_token_unique" UNIQUE("report_token")
);
--> statement-breakpoint
ALTER TABLE "wb_anonymous_mailbox" ADD CONSTRAINT "wb_anonymous_mailbox_report_id_wb_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."wb_report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case" ADD CONSTRAINT "wb_case_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case" ADD CONSTRAINT "wb_case_report_id_wb_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."wb_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case" ADD CONSTRAINT "wb_case_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case_evidence" ADD CONSTRAINT "wb_case_evidence_case_id_wb_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."wb_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case_evidence" ADD CONSTRAINT "wb_case_evidence_report_id_wb_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."wb_report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case_evidence" ADD CONSTRAINT "wb_case_evidence_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case_evidence" ADD CONSTRAINT "wb_case_evidence_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case_message" ADD CONSTRAINT "wb_case_message_case_id_wb_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."wb_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case_message" ADD CONSTRAINT "wb_case_message_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_case_message" ADD CONSTRAINT "wb_case_message_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wb_report" ADD CONSTRAINT "wb_report_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wc_org_idx" ON "wb_case" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "wc_status_idx" ON "wb_case" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "wc_deadline_idx" ON "wb_case" USING btree ("acknowledge_deadline");--> statement-breakpoint
CREATE INDEX "wce_case_idx" ON "wb_case_evidence" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "wcm_case_idx" ON "wb_case_message" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "wr_org_idx" ON "wb_report" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wr_token_idx" ON "wb_report" USING btree ("report_token");