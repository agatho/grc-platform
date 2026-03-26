CREATE TYPE "public"."catalog_object_type" AS ENUM('it_system', 'application', 'role', 'department', 'location', 'vendor', 'standard', 'regulation', 'custom');--> statement-breakpoint
CREATE TABLE "catalog_entry_reference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_entry_id" uuid NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_entry_ref_uniq" UNIQUE("catalog_entry_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "catalog_lifecycle_phase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"phase_name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"version" varchar(50),
	"source" varchar(100) NOT NULL,
	"language" varchar(10) DEFAULT 'de' NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_catalog_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"parent_entry_id" uuid,
	"code" varchar(50) NOT NULL,
	"title_de" varchar(500) NOT NULL,
	"title_en" varchar(500),
	"description_de" text,
	"description_en" text,
	"implementation_de" text,
	"implementation_en" text,
	"level" integer NOT NULL,
	"control_type_cat" varchar(50),
	"default_frequency" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "control_catalog_entry_code_uniq" UNIQUE("catalog_id","code")
);
--> statement-breakpoint
CREATE TABLE "general_catalog_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"object_type" "catalog_object_type" NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"lifecycle_start" date,
	"lifecycle_end" date,
	"owner_id" uuid,
	"metadata_json" jsonb,
	"tags" text[] DEFAULT '{}'::text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "org_active_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"catalog_type" varchar(50) NOT NULL,
	"catalog_id" uuid NOT NULL,
	"enforcement_level" varchar(50) DEFAULT 'optional' NOT NULL,
	"is_mandatory_from_parent" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_by" uuid,
	CONSTRAINT "org_active_catalog_uniq" UNIQUE("org_id","catalog_type","catalog_id")
);
--> statement-breakpoint
CREATE TABLE "org_catalog_exclusion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entry_type" varchar(50) NOT NULL,
	"entry_id" uuid NOT NULL,
	"reason" text,
	"excluded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"excluded_by" uuid,
	CONSTRAINT "org_catalog_exclusion_uniq" UNIQUE("org_id","entry_type","entry_id")
);
--> statement-breakpoint
CREATE TABLE "org_risk_methodology" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"methodology" varchar(50) DEFAULT 'iso_31000' NOT NULL,
	"matrix_size" integer DEFAULT 5 NOT NULL,
	"fair_currency" varchar(10) DEFAULT 'EUR' NOT NULL,
	"fair_simulation_runs" integer DEFAULT 10000 NOT NULL,
	"risk_appetite_threshold" integer,
	"custom_labels_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "org_risk_methodology_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "risk_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"version" varchar(50),
	"source" varchar(100) NOT NULL,
	"language" varchar(10) DEFAULT 'de' NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_catalog_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"parent_entry_id" uuid,
	"code" varchar(50) NOT NULL,
	"title_de" varchar(500) NOT NULL,
	"title_en" varchar(500),
	"description_de" text,
	"description_en" text,
	"level" integer NOT NULL,
	"risk_category" varchar(50),
	"default_likelihood" integer,
	"default_impact" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_catalog_entry_code_uniq" UNIQUE("catalog_id","code")
);
--> statement-breakpoint
ALTER TABLE "control" ADD COLUMN "catalog_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog_entry_reference" ADD CONSTRAINT "catalog_entry_reference_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_lifecycle_phase" ADD CONSTRAINT "catalog_lifecycle_phase_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_catalog_entry" ADD CONSTRAINT "control_catalog_entry_catalog_id_control_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."control_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_catalog_entry" ADD CONSTRAINT "control_catalog_entry_parent_entry_id_control_catalog_entry_id_fk" FOREIGN KEY ("parent_entry_id") REFERENCES "public"."control_catalog_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_catalog_entry" ADD CONSTRAINT "general_catalog_entry_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_catalog_entry" ADD CONSTRAINT "general_catalog_entry_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_active_catalog" ADD CONSTRAINT "org_active_catalog_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_active_catalog" ADD CONSTRAINT "org_active_catalog_activated_by_user_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_catalog_exclusion" ADD CONSTRAINT "org_catalog_exclusion_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_catalog_exclusion" ADD CONSTRAINT "org_catalog_exclusion_excluded_by_user_id_fk" FOREIGN KEY ("excluded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_risk_methodology" ADD CONSTRAINT "org_risk_methodology_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_risk_methodology" ADD CONSTRAINT "org_risk_methodology_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_catalog_entry" ADD CONSTRAINT "risk_catalog_entry_catalog_id_risk_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."risk_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_catalog_entry" ADD CONSTRAINT "risk_catalog_entry_parent_entry_id_risk_catalog_entry_id_fk" FOREIGN KEY ("parent_entry_id") REFERENCES "public"."risk_catalog_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cer_org_idx" ON "catalog_entry_reference" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "cer_entry_idx" ON "catalog_entry_reference" USING btree ("catalog_entry_id");--> statement-breakpoint
CREATE INDEX "cer_entity_idx" ON "catalog_entry_reference" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "clp_org_idx" ON "catalog_lifecycle_phase" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "clp_entity_idx" ON "catalog_lifecycle_phase" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "control_catalog_source_idx" ON "control_catalog" USING btree ("source");--> statement-breakpoint
CREATE INDEX "control_catalog_active_idx" ON "control_catalog" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "cce_catalog_idx" ON "control_catalog_entry" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "cce_parent_idx" ON "control_catalog_entry" USING btree ("parent_entry_id");--> statement-breakpoint
CREATE INDEX "cce_level_idx" ON "control_catalog_entry" USING btree ("catalog_id","level");--> statement-breakpoint
CREATE INDEX "gce_org_type_idx" ON "general_catalog_entry" USING btree ("org_id","object_type");--> statement-breakpoint
CREATE INDEX "gce_owner_idx" ON "general_catalog_entry" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "gce_status_idx" ON "general_catalog_entry" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "oac_org_idx" ON "org_active_catalog" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "oac_catalog_idx" ON "org_active_catalog" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "oce_org_idx" ON "org_catalog_exclusion" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_methodology_org_idx" ON "org_risk_methodology" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "risk_catalog_source_idx" ON "risk_catalog" USING btree ("source");--> statement-breakpoint
CREATE INDEX "risk_catalog_active_idx" ON "risk_catalog" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rce_catalog_idx" ON "risk_catalog_entry" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "rce_parent_idx" ON "risk_catalog_entry" USING btree ("parent_entry_id");--> statement-breakpoint
CREATE INDEX "rce_level_idx" ON "risk_catalog_entry" USING btree ("catalog_id","level");