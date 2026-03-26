CREATE TYPE "public"."data_quality" AS ENUM('measured', 'estimated', 'calculated');--> statement-breakpoint
CREATE TYPE "public"."esg_frequency" AS ENUM('annual', 'semi_annual', 'quarterly');--> statement-breakpoint
CREATE TYPE "public"."materiality_status" AS ENUM('draft', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('draft', 'in_review', 'approved', 'published');--> statement-breakpoint
CREATE TYPE "public"."target_status" AS ENUM('on_track', 'at_risk', 'off_track', 'achieved');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('absolute', 'intensity', 'relative');--> statement-breakpoint
CREATE TABLE "esg_annual_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"reporting_year" integer NOT NULL,
	"status" "report_status" DEFAULT 'draft' NOT NULL,
	"completeness_percent" integer DEFAULT 0,
	"exported_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esg_control_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"datapoint_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esg_materiality_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"reporting_year" integer NOT NULL,
	"status" "materiality_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esg_materiality_topic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"esrs_standard" varchar(10) NOT NULL,
	"topic_name" varchar(200) NOT NULL,
	"impact_score" numeric(4, 2),
	"financial_score" numeric(4, 2),
	"is_material" boolean,
	"justification" text,
	"stakeholder_consensus" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "esg_materiality_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"voter_id" uuid,
	"voter_name" varchar(200),
	"voter_type" varchar(50) NOT NULL,
	"impact_score" numeric(4, 2) NOT NULL,
	"financial_score" numeric(4, 2) NOT NULL,
	"comment" text,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esg_measurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"metric_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"value" numeric(15, 4) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"data_quality" "data_quality" DEFAULT 'estimated' NOT NULL,
	"source" varchar(200),
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"notes" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esg_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"metric_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"baseline_year" integer NOT NULL,
	"baseline_value" numeric(20, 6) NOT NULL,
	"target_year" integer NOT NULL,
	"target_value" numeric(20, 6) NOT NULL,
	"target_type" "target_type" DEFAULT 'absolute' NOT NULL,
	"sbti_aligned" boolean DEFAULT false NOT NULL,
	"status" "target_status" DEFAULT 'on_track' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esrs_datapoint_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"esrs_standard" varchar(10) NOT NULL,
	"disclosure_requirement" varchar(20) NOT NULL,
	"datapoint_code" varchar(30) NOT NULL,
	"name_de" varchar(500) NOT NULL,
	"name_en" varchar(500) NOT NULL,
	"description_de" text,
	"description_en" text,
	"data_type" varchar(20) NOT NULL,
	"unit" varchar(50),
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"frequency" varchar(20) DEFAULT 'annual',
	"calculation_method" text,
	"related_topics" text[],
	CONSTRAINT "esrs_datapoint_definition_datapoint_code_unique" UNIQUE("datapoint_code")
);
--> statement-breakpoint
CREATE TABLE "esrs_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"datapoint_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"frequency" "esg_frequency" DEFAULT 'annual' NOT NULL,
	"collection_method" varchar(20) DEFAULT 'manual',
	"calculation_formula" text,
	"responsible_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "esg_annual_report" ADD CONSTRAINT "esg_annual_report_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_annual_report" ADD CONSTRAINT "esg_annual_report_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_control_link" ADD CONSTRAINT "esg_control_link_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_control_link" ADD CONSTRAINT "esg_control_link_datapoint_id_esrs_datapoint_definition_id_fk" FOREIGN KEY ("datapoint_id") REFERENCES "public"."esrs_datapoint_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_control_link" ADD CONSTRAINT "esg_control_link_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_materiality_assessment" ADD CONSTRAINT "esg_materiality_assessment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_materiality_assessment" ADD CONSTRAINT "esg_materiality_assessment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_materiality_topic" ADD CONSTRAINT "esg_materiality_topic_assessment_id_esg_materiality_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."esg_materiality_assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_materiality_vote" ADD CONSTRAINT "esg_materiality_vote_topic_id_esg_materiality_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."esg_materiality_topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_materiality_vote" ADD CONSTRAINT "esg_materiality_vote_voter_id_user_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_measurement" ADD CONSTRAINT "esg_measurement_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_measurement" ADD CONSTRAINT "esg_measurement_metric_id_esrs_metric_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."esrs_metric"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_measurement" ADD CONSTRAINT "esg_measurement_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_target" ADD CONSTRAINT "esg_target_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esg_target" ADD CONSTRAINT "esg_target_metric_id_esrs_metric_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."esrs_metric"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esrs_metric" ADD CONSTRAINT "esrs_metric_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esrs_metric" ADD CONSTRAINT "esrs_metric_datapoint_id_esrs_datapoint_definition_id_fk" FOREIGN KEY ("datapoint_id") REFERENCES "public"."esrs_datapoint_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esrs_metric" ADD CONSTRAINT "esrs_metric_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ear_org_year_idx" ON "esg_annual_report" USING btree ("org_id","reporting_year");--> statement-breakpoint
CREATE UNIQUE INDEX "ecl_unique_idx" ON "esg_control_link" USING btree ("org_id","datapoint_id","control_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ema_org_year_idx" ON "esg_materiality_assessment" USING btree ("org_id","reporting_year");--> statement-breakpoint
CREATE INDEX "emt_assessment_idx" ON "esg_materiality_topic" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "emv_topic_idx" ON "esg_materiality_vote" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "emeas_org_metric_idx" ON "esg_measurement" USING btree ("org_id","metric_id");--> statement-breakpoint
CREATE INDEX "emeas_metric_period_idx" ON "esg_measurement" USING btree ("metric_id","period_start");--> statement-breakpoint
CREATE INDEX "et_org_idx" ON "esg_target" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "em_org_idx" ON "esrs_metric" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "em_datapoint_idx" ON "esrs_metric" USING btree ("org_id","datapoint_id");