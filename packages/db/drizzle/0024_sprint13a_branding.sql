CREATE TYPE "public"."report_template" AS ENUM('standard', 'formal', 'minimal');--> statement-breakpoint
CREATE TABLE "org_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"primary_color" varchar(7) DEFAULT '#2563eb' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#1e40af' NOT NULL,
	"accent_color" varchar(7) DEFAULT '#f59e0b' NOT NULL,
	"text_color" varchar(7) DEFAULT '#0f172a' NOT NULL,
	"background_color" varchar(7) DEFAULT '#ffffff' NOT NULL,
	"dark_mode_primary_color" varchar(7),
	"dark_mode_accent_color" varchar(7),
	"logo_path" varchar(1000),
	"favicon_path" varchar(1000),
	"report_template" "report_template" DEFAULT 'standard' NOT NULL,
	"confidentiality_notice" text DEFAULT 'CONFIDENTIAL -- For internal use only',
	"custom_css" text,
	"inherit_from_parent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "org_branding_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "user_dashboard_layout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"layout_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_branding" ADD CONSTRAINT "org_branding_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_branding" ADD CONSTRAINT "org_branding_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_layout" ADD CONSTRAINT "user_dashboard_layout_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_layout" ADD CONSTRAINT "user_dashboard_layout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ob_org_idx" ON "org_branding" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "udl_org_user_idx" ON "user_dashboard_layout" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "udl_org_default_idx" ON "user_dashboard_layout" USING btree ("org_id","is_default");