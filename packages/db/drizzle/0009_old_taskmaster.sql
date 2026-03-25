CREATE TABLE "process_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "process_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_type" varchar(50),
	"link_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "process_step_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_step_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "process" ADD COLUMN "review_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "process" ADD COLUMN "review_cycle_days" integer;--> statement-breakpoint
ALTER TABLE "process" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "process" ADD COLUMN "last_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "process_asset" ADD CONSTRAINT "process_asset_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_asset" ADD CONSTRAINT "process_asset_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_asset" ADD CONSTRAINT "process_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_asset" ADD CONSTRAINT "process_asset_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_document" ADD CONSTRAINT "process_document_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_document" ADD CONSTRAINT "process_document_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_document" ADD CONSTRAINT "process_document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_asset" ADD CONSTRAINT "process_step_asset_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_asset" ADD CONSTRAINT "process_step_asset_process_step_id_process_step_id_fk" FOREIGN KEY ("process_step_id") REFERENCES "public"."process_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_asset" ADD CONSTRAINT "process_step_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_asset" ADD CONSTRAINT "process_step_asset_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "process_asset_process_idx" ON "process_asset" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_asset_asset_idx" ON "process_asset" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "process_document_process_idx" ON "process_document" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_document_document_idx" ON "process_document" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "process_step_asset_step_idx" ON "process_step_asset" USING btree ("process_step_id");--> statement-breakpoint
CREATE INDEX "process_step_asset_asset_idx" ON "process_step_asset" USING btree ("asset_id");--> statement-breakpoint
ALTER TABLE "process" ADD CONSTRAINT "process_last_reviewed_by_user_id_fk" FOREIGN KEY ("last_reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;