CREATE TYPE "public"."module_ui_status" AS ENUM('disabled', 'preview', 'enabled', 'maintenance');--> statement-breakpoint
CREATE TABLE "module_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"module_key" varchar(50) NOT NULL,
	"ui_status" "module_ui_status" DEFAULT 'disabled' NOT NULL,
	"is_data_active" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"license_tier" varchar(50) DEFAULT 'included',
	"licensed_until" date,
	"enabled_at" timestamp with time zone,
	"enabled_by" uuid,
	"disabled_at" timestamp with time zone,
	"disabled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "module_config_org_module_uq" UNIQUE("org_id","module_key")
);
--> statement-breakpoint
CREATE TABLE "module_definition" (
	"module_key" varchar(50) PRIMARY KEY NOT NULL,
	"display_name_de" varchar(100) NOT NULL,
	"display_name_en" varchar(100) NOT NULL,
	"description_de" text,
	"description_en" text,
	"icon" varchar(50),
	"nav_path" varchar(100),
	"nav_section" varchar(50),
	"nav_order" integer NOT NULL,
	"requires_modules" text[] DEFAULT '{}' NOT NULL,
	"license_tier" varchar(50) DEFAULT 'included' NOT NULL,
	"is_active_in_platform" boolean DEFAULT true NOT NULL,
	"background_processes" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "module_config" ADD CONSTRAINT "module_config_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_config" ADD CONSTRAINT "module_config_module_key_module_definition_module_key_fk" FOREIGN KEY ("module_key") REFERENCES "public"."module_definition"("module_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_config" ADD CONSTRAINT "module_config_enabled_by_user_id_fk" FOREIGN KEY ("enabled_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_config" ADD CONSTRAINT "module_config_disabled_by_user_id_fk" FOREIGN KEY ("disabled_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_config" ADD CONSTRAINT "module_config_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_config" ADD CONSTRAINT "module_config_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "module_config_lookup_idx" ON "module_config" USING btree ("org_id","module_key","ui_status");