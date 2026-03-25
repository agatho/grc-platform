CREATE TYPE "public"."process_notation" AS ENUM('bpmn', 'value_chain', 'epc');--> statement-breakpoint
CREATE TYPE "public"."process_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."step_type" AS ENUM('task', 'gateway', 'event', 'subprocess', 'call_activity');--> statement-breakpoint
CREATE TABLE "process" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"parent_process_id" uuid,
	"name" varchar(500) NOT NULL,
	"description" text,
	"level" integer DEFAULT 1 NOT NULL,
	"notation" "process_notation" DEFAULT 'bpmn' NOT NULL,
	"status" "process_status" DEFAULT 'draft' NOT NULL,
	"process_owner_id" uuid,
	"reviewer_id" uuid,
	"department" varchar(255),
	"current_version" integer DEFAULT 1 NOT NULL,
	"is_essential" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "process_control" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"control_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "process_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"bpmn_element_id" varchar(255) NOT NULL,
	"name" varchar(500),
	"description" text,
	"step_type" "step_type" DEFAULT 'task' NOT NULL,
	"responsible_role" varchar(255),
	"sequence_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "process_step_control" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_step_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"control_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "process_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"bpmn_xml" text,
	"diagram_json" jsonb,
	"change_summary" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "process" ADD CONSTRAINT "process_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process" ADD CONSTRAINT "process_parent_process_id_process_id_fk" FOREIGN KEY ("parent_process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process" ADD CONSTRAINT "process_process_owner_id_user_id_fk" FOREIGN KEY ("process_owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process" ADD CONSTRAINT "process_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_control" ADD CONSTRAINT "process_control_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_control" ADD CONSTRAINT "process_control_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_control" ADD CONSTRAINT "process_control_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step" ADD CONSTRAINT "process_step_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step" ADD CONSTRAINT "process_step_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_control" ADD CONSTRAINT "process_step_control_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_control" ADD CONSTRAINT "process_step_control_process_step_id_process_step_id_fk" FOREIGN KEY ("process_step_id") REFERENCES "public"."process_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_control" ADD CONSTRAINT "process_step_control_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_version" ADD CONSTRAINT "process_version_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_version" ADD CONSTRAINT "process_version_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_version" ADD CONSTRAINT "process_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "process_org_idx" ON "process" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "process_parent_idx" ON "process" USING btree ("parent_process_id");--> statement-breakpoint
CREATE INDEX "process_owner_idx" ON "process" USING btree ("process_owner_id");--> statement-breakpoint
CREATE INDEX "process_status_idx" ON "process" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "process_level_idx" ON "process" USING btree ("org_id","level");--> statement-breakpoint
CREATE INDEX "process_control_process_idx" ON "process_control" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_control_control_idx" ON "process_control" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "process_control_org_idx" ON "process_control" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "process_step_process_idx" ON "process_step" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_step_org_idx" ON "process_step" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "process_step_unique" ON "process_step" USING btree ("process_id","bpmn_element_id");--> statement-breakpoint
CREATE INDEX "process_step_control_step_idx" ON "process_step_control" USING btree ("process_step_id");--> statement-breakpoint
CREATE INDEX "process_step_control_control_idx" ON "process_step_control" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "process_step_control_org_idx" ON "process_step_control" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "process_version_process_idx" ON "process_version" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_version_org_idx" ON "process_version" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "process_version_unique" ON "process_version" USING btree ("process_id","version_number");