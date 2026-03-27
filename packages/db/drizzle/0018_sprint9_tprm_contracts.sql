CREATE TYPE "public"."contract_status" AS ENUM('draft', 'negotiation', 'pending_approval', 'active', 'renewal', 'expired', 'terminated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('master_agreement', 'service_agreement', 'nda', 'dpa', 'sla', 'license', 'maintenance', 'consulting', 'other');--> statement-breakpoint
CREATE TYPE "public"."dd_status" AS ENUM('pending', 'in_progress', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."obligation_status" AS ENUM('pending', 'in_progress', 'completed', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."obligation_type" AS ENUM('deliverable', 'payment', 'reporting', 'compliance', 'audit_right');--> statement-breakpoint
CREATE TYPE "public"."vendor_category" AS ENUM('it_services', 'cloud_provider', 'consulting', 'facility', 'logistics', 'raw_materials', 'financial', 'hr_services', 'other');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('prospect', 'onboarding', 'active', 'under_review', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."vendor_tier" AS ENUM('critical', 'important', 'standard', 'low_risk');--> statement-breakpoint
CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"vendor_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"contract_type" "contract_type" DEFAULT 'service_agreement' NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"contract_number" varchar(100),
	"effective_date" date,
	"expiration_date" date,
	"notice_period_days" integer DEFAULT 90,
	"auto_renewal" boolean DEFAULT false NOT NULL,
	"renewal_period_months" integer,
	"total_value" numeric(15, 2),
	"currency" char(3) DEFAULT 'EUR',
	"annual_value" numeric(15, 2),
	"payment_terms" varchar(255),
	"document_id" uuid,
	"owner_id" uuid,
	"approver_id" uuid,
	"signed_date" date,
	"signed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "contract_amendment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"effective_date" date,
	"document_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_obligation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"obligation_type" "obligation_type" NOT NULL,
	"due_date" date,
	"recurring" boolean DEFAULT false NOT NULL,
	"recurring_interval_months" integer,
	"status" "obligation_status" DEFAULT 'pending' NOT NULL,
	"responsible_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_sla" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"metric_name" varchar(255) NOT NULL,
	"target_value" numeric(10, 4) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"measurement_frequency" varchar(20) NOT NULL,
	"penalty_clause" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_sla_measurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sla_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"actual_value" numeric(10, 4) NOT NULL,
	"is_breach" boolean DEFAULT false NOT NULL,
	"notes" text,
	"measured_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lksg_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"assessment_date" date NOT NULL,
	"lksg_tier" varchar(20) NOT NULL,
	"risk_areas" jsonb DEFAULT '[]',
	"mitigation_plans" jsonb DEFAULT '[]',
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"overall_risk_level" varchar(20),
	"assessed_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"next_review_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"name" varchar(500) NOT NULL,
	"legal_name" varchar(500),
	"description" text,
	"category" "vendor_category" DEFAULT 'other' NOT NULL,
	"tier" "vendor_tier" DEFAULT 'standard' NOT NULL,
	"status" "vendor_status" DEFAULT 'prospect' NOT NULL,
	"country" varchar(100),
	"address" text,
	"website" varchar(500),
	"tax_id" varchar(100),
	"inherent_risk_score" integer,
	"residual_risk_score" integer,
	"last_assessment_date" date,
	"next_assessment_date" date,
	"is_lksg_relevant" boolean DEFAULT false NOT NULL,
	"lksg_tier" varchar(20),
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "vendor_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"role" varchar(255),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_due_diligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"questionnaire_version" varchar(50),
	"status" "dd_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"access_token" varchar(255),
	"responses" jsonb DEFAULT '{}',
	"risk_score" integer,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_due_diligence_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"question_text" text NOT NULL,
	"answer_type" varchar(50) DEFAULT 'text' NOT NULL,
	"risk_weighting" numeric(5, 2) DEFAULT '1.00',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_risk_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"assessment_date" date NOT NULL,
	"inherent_risk_score" integer NOT NULL,
	"residual_risk_score" integer NOT NULL,
	"confidentiality_score" integer,
	"integrity_score" integer,
	"availability_score" integer,
	"compliance_score" integer,
	"financial_score" integer,
	"reputation_score" integer,
	"controls_applied" jsonb DEFAULT '[]',
	"risk_trend" varchar(20),
	"assessed_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- ALTER TABLE "finding" ADD COLUMN "audit_id" uuid; -- already added in 0017--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_signed_by_user_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendment" ADD CONSTRAINT "contract_amendment_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendment" ADD CONSTRAINT "contract_amendment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendment" ADD CONSTRAINT "contract_amendment_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendment" ADD CONSTRAINT "contract_amendment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_sla" ADD CONSTRAINT "contract_sla_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_sla" ADD CONSTRAINT "contract_sla_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_sla_measurement" ADD CONSTRAINT "contract_sla_measurement_sla_id_contract_sla_id_fk" FOREIGN KEY ("sla_id") REFERENCES "public"."contract_sla"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_sla_measurement" ADD CONSTRAINT "contract_sla_measurement_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_sla_measurement" ADD CONSTRAINT "contract_sla_measurement_measured_by_user_id_fk" FOREIGN KEY ("measured_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lksg_assessment" ADD CONSTRAINT "lksg_assessment_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lksg_assessment" ADD CONSTRAINT "lksg_assessment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lksg_assessment" ADD CONSTRAINT "lksg_assessment_assessed_by_user_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lksg_assessment" ADD CONSTRAINT "lksg_assessment_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_contact" ADD CONSTRAINT "vendor_contact_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_contact" ADD CONSTRAINT "vendor_contact_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_due_diligence" ADD CONSTRAINT "vendor_due_diligence_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_due_diligence" ADD CONSTRAINT "vendor_due_diligence_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_due_diligence" ADD CONSTRAINT "vendor_due_diligence_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_due_diligence_question" ADD CONSTRAINT "vendor_due_diligence_question_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_risk_assessment" ADD CONSTRAINT "vendor_risk_assessment_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_risk_assessment" ADD CONSTRAINT "vendor_risk_assessment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_risk_assessment" ADD CONSTRAINT "vendor_risk_assessment_assessed_by_user_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_vendor_idx" ON "contract" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "contract_status_idx" ON "contract" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "contract_expiry_idx" ON "contract" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "contract_owner_idx" ON "contract" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "amendment_contract_idx" ON "contract_amendment" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "obligation_contract_idx" ON "contract_obligation" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "obligation_status_idx" ON "contract_obligation" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "obligation_due_idx" ON "contract_obligation" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "sla_contract_idx" ON "contract_sla" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "sla_measurement_sla_idx" ON "contract_sla_measurement" USING btree ("sla_id");--> statement-breakpoint
CREATE INDEX "sla_measurement_period_idx" ON "contract_sla_measurement" USING btree ("sla_id","period_start");--> statement-breakpoint
CREATE INDEX "lksg_vendor_idx" ON "lksg_assessment" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "lksg_org_status_idx" ON "lksg_assessment" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "vendor_org_idx" ON "vendor" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendor_status_idx" ON "vendor" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "vendor_tier_idx" ON "vendor" USING btree ("org_id","tier");--> statement-breakpoint
CREATE INDEX "vendor_owner_idx" ON "vendor" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "vendor_contact_vendor_idx" ON "vendor_contact" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vdd_vendor_idx" ON "vendor_due_diligence" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vdd_access_token_idx" ON "vendor_due_diligence" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "vddq_org_category_idx" ON "vendor_due_diligence_question" USING btree ("org_id","category");--> statement-breakpoint
CREATE INDEX "vra_vendor_idx" ON "vendor_risk_assessment" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vra_date_idx" ON "vendor_risk_assessment" USING btree ("vendor_id","assessment_date");