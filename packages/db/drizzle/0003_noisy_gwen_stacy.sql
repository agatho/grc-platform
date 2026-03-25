CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in_progress', 'done', 'overdue', 'cancelled');--> statement-breakpoint
-- ALTER TYPE "public"."notification_channel" ADD VALUE 'both'; (applied manually outside transaction)
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"assignee_id" uuid,
	"assignee_role" varchar(50),
	"due_date" timestamp with time zone,
	"reminder_at" timestamp with time zone,
	"escalation_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"source_entity_type" varchar(50),
	"source_entity_id" uuid,
	"tags" text[] DEFAULT '{}'::text[],
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "task_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "template_key" varchar(100);--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "template_data" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "email_message_id" varchar(255);--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "email_error" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "org_code" varchar(10);--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "is_data_controller" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "dpo_user_id" uuid;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "supervisory_authority" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "data_residency" varchar(2);--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "gdpr_settings" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notification_preferences" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_org_id_idx" ON "task" USING btree ("org_id") WHERE "task"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_assignee_idx" ON "task" USING btree ("assignee_id") WHERE "task"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_due_date_idx" ON "task" USING btree ("due_date") WHERE "task"."deleted_at" IS NULL AND "task"."status" NOT IN ('done', 'cancelled');--> statement-breakpoint
CREATE INDEX "task_source_entity_idx" ON "task" USING btree ("source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "tc_task_idx" ON "task_comment" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tc_org_idx" ON "task_comment" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_dpo_user_id_user_id_fk" FOREIGN KEY ("dpo_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_org_code_unique" UNIQUE("org_code");