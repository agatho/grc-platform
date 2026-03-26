CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('detected', 'triaged', 'contained', 'eradicated', 'recovered', 'lessons_learned', 'closed');--> statement-breakpoint
CREATE TYPE "public"."protection_level" AS ENUM('normal', 'high', 'very_high');--> statement-breakpoint
CREATE TABLE "asset_classification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"confidentiality_level" "protection_level" DEFAULT 'normal' NOT NULL,
	"confidentiality_reason" text,
	"integrity_level" "protection_level" DEFAULT 'normal' NOT NULL,
	"integrity_reason" text,
	"availability_level" "protection_level" DEFAULT 'normal' NOT NULL,
	"availability_reason" text,
	"overall_protection" "protection_level" DEFAULT 'normal' NOT NULL,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"classified_by" uuid NOT NULL,
	"review_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_classification_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "incident_timeline_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_scenario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" uuid,
	"threat_id" uuid,
	"vulnerability_id" uuid,
	"asset_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"element_id" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"severity" "incident_severity" DEFAULT 'medium' NOT NULL,
	"status" "incident_status" DEFAULT 'detected' NOT NULL,
	"incident_type" varchar(100),
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_by" uuid,
	"assigned_to" uuid,
	"affected_asset_ids" uuid[] DEFAULT '{}',
	"affected_process_ids" uuid[] DEFAULT '{}',
	"is_data_breach" boolean DEFAULT false NOT NULL,
	"data_breach_72h_deadline" timestamp with time zone,
	"root_cause" text,
	"remediation_actions" text,
	"lessons_learned" text,
	"closed_at" timestamp with time zone,
	"work_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "threat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"catalog_entry_id" uuid,
	"code" varchar(50),
	"title" varchar(500) NOT NULL,
	"description" text,
	"threat_category" varchar(100),
	"likelihood_rating" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "vulnerability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"cve_reference" varchar(50),
	"affected_asset_id" uuid,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"mitigation_control_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "asset_classification" ADD CONSTRAINT "asset_classification_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_classification" ADD CONSTRAINT "asset_classification_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_classification" ADD CONSTRAINT "asset_classification_classified_by_user_id_fk" FOREIGN KEY ("classified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_timeline_entry" ADD CONSTRAINT "incident_timeline_entry_incident_id_security_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."security_incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_timeline_entry" ADD CONSTRAINT "incident_timeline_entry_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_timeline_entry" ADD CONSTRAINT "incident_timeline_entry_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scenario" ADD CONSTRAINT "risk_scenario_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scenario" ADD CONSTRAINT "risk_scenario_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scenario" ADD CONSTRAINT "risk_scenario_threat_id_threat_id_fk" FOREIGN KEY ("threat_id") REFERENCES "public"."threat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scenario" ADD CONSTRAINT "risk_scenario_vulnerability_id_vulnerability_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "public"."vulnerability"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scenario" ADD CONSTRAINT "risk_scenario_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incident" ADD CONSTRAINT "security_incident_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incident" ADD CONSTRAINT "security_incident_reported_by_user_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incident" ADD CONSTRAINT "security_incident_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incident" ADD CONSTRAINT "security_incident_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incident" ADD CONSTRAINT "security_incident_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incident" ADD CONSTRAINT "security_incident_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat" ADD CONSTRAINT "threat_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat" ADD CONSTRAINT "threat_catalog_entry_id_risk_catalog_entry_id_fk" FOREIGN KEY ("catalog_entry_id") REFERENCES "public"."risk_catalog_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat" ADD CONSTRAINT "threat_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerability" ADD CONSTRAINT "vulnerability_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerability" ADD CONSTRAINT "vulnerability_affected_asset_id_asset_id_fk" FOREIGN KEY ("affected_asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerability" ADD CONSTRAINT "vulnerability_mitigation_control_id_control_id_fk" FOREIGN KEY ("mitigation_control_id") REFERENCES "public"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerability" ADD CONSTRAINT "vulnerability_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ac_org_idx" ON "asset_classification" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ac_overall_idx" ON "asset_classification" USING btree ("org_id","overall_protection");--> statement-breakpoint
CREATE INDEX "ite_incident_idx" ON "incident_timeline_entry" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "ite_org_idx" ON "incident_timeline_entry" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rs_org_idx" ON "risk_scenario" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rs_threat_idx" ON "risk_scenario" USING btree ("threat_id");--> statement-breakpoint
CREATE INDEX "rs_vuln_idx" ON "risk_scenario" USING btree ("vulnerability_id");--> statement-breakpoint
CREATE INDEX "rs_asset_idx" ON "risk_scenario" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "rs_risk_idx" ON "risk_scenario" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "si_org_idx" ON "security_incident" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "si_status_idx" ON "security_incident" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "si_severity_idx" ON "security_incident" USING btree ("org_id","severity");--> statement-breakpoint
CREATE INDEX "si_breach_idx" ON "security_incident" USING btree ("org_id") WHERE is_data_breach = true;--> statement-breakpoint
CREATE INDEX "threat_org_idx" ON "threat" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "threat_category_idx" ON "threat" USING btree ("org_id","threat_category");--> statement-breakpoint
CREATE INDEX "vuln_org_idx" ON "vulnerability" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vuln_asset_idx" ON "vulnerability" USING btree ("affected_asset_id");--> statement-breakpoint
CREATE INDEX "vuln_severity_idx" ON "vulnerability" USING btree ("org_id","severity");