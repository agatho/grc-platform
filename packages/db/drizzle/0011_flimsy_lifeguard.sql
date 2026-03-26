CREATE TYPE "public"."automation_level" AS ENUM('manual', 'semi_automated', 'fully_automated');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."control_assertion" AS ENUM('completeness', 'accuracy', 'obligations_and_rights', 'fraud_prevention', 'existence', 'valuation', 'presentation', 'safeguarding_of_assets');--> statement-breakpoint
CREATE TYPE "public"."control_freq" AS ENUM('event_driven', 'continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc');--> statement-breakpoint
CREATE TYPE "public"."control_status" AS ENUM('designed', 'implemented', 'effective', 'ineffective', 'retired');--> statement-breakpoint
CREATE TYPE "public"."control_type" AS ENUM('preventive', 'detective', 'corrective');--> statement-breakpoint
CREATE TYPE "public"."evidence_category" AS ENUM('screenshot', 'document', 'log_export', 'email', 'certificate', 'report', 'photo', 'config_export', 'other');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('observation', 'recommendation', 'improvement_requirement', 'insignificant_nonconformity', 'significant_nonconformity');--> statement-breakpoint
CREATE TYPE "public"."finding_source" AS ENUM('control_test', 'audit', 'incident', 'self_assessment', 'external');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('identified', 'in_remediation', 'remediated', 'verified', 'accepted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."test_result" AS ENUM('effective', 'ineffective', 'partially_effective', 'not_tested');--> statement-breakpoint
CREATE TYPE "public"."test_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."test_type" AS ENUM('design_effectiveness', 'operating_effectiveness');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('policy', 'procedure', 'guideline', 'template', 'record', 'tom', 'dpa', 'bcp', 'soa', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'archived', 'expired');--> statement-breakpoint
CREATE TABLE "control" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"control_type" "control_type" NOT NULL,
	"frequency" "control_freq" DEFAULT 'event_driven' NOT NULL,
	"automation_level" "automation_level" DEFAULT 'manual' NOT NULL,
	"status" "control_status" DEFAULT 'designed' NOT NULL,
	"assertions" text[] DEFAULT '{}'::text[],
	"owner_id" uuid,
	"department" varchar(255),
	"objective" text,
	"test_instructions" text,
	"review_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "control_test" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"campaign_id" uuid,
	"task_id" uuid,
	"test_type" "test_type" NOT NULL,
	"status" "test_status" DEFAULT 'planned' NOT NULL,
	"tod_result" "test_result",
	"toe_result" "test_result",
	"tester_id" uuid,
	"test_date" date,
	"sample_size" integer,
	"sample_description" text,
	"conclusion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "control_test_campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"responsible_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"category" "evidence_category" DEFAULT 'other' NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_path" varchar(1000) NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(255),
	"description" text,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"control_id" uuid,
	"control_test_id" uuid,
	"risk_id" uuid,
	"task_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"severity" "finding_severity" NOT NULL,
	"status" "finding_status" DEFAULT 'identified' NOT NULL,
	"source" "finding_source" DEFAULT 'control_test' NOT NULL,
	"owner_id" uuid,
	"remediation_plan" text,
	"remediation_due_date" date,
	"remediated_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "acknowledgment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"version_acknowledged" integer NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ack_document_user_unique" UNIQUE("document_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"content" text,
	"category" "document_category" DEFAULT 'other' NOT NULL,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"requires_acknowledgment" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}'::text[],
	"owner_id" uuid,
	"reviewer_id" uuid,
	"approver_id" uuid,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"review_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "document_entity_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"link_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "document_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" text,
	"change_summary" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dv_document_version_unique" UNIQUE("document_id","version_number")
);
--> statement-breakpoint
ALTER TABLE "control" ADD CONSTRAINT "control_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control" ADD CONSTRAINT "control_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control" ADD CONSTRAINT "control_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_test" ADD CONSTRAINT "control_test_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_test" ADD CONSTRAINT "control_test_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_test" ADD CONSTRAINT "control_test_campaign_id_control_test_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."control_test_campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_test" ADD CONSTRAINT "control_test_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_test" ADD CONSTRAINT "control_test_tester_id_user_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_test_campaign" ADD CONSTRAINT "control_test_campaign_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_test_campaign" ADD CONSTRAINT "control_test_campaign_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_control_test_id_control_test_id_fk" FOREIGN KEY ("control_test_id") REFERENCES "public"."control_test"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgment" ADD CONSTRAINT "acknowledgment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgment" ADD CONSTRAINT "acknowledgment_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgment" ADD CONSTRAINT "acknowledgment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_entity_link" ADD CONSTRAINT "document_entity_link_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_entity_link" ADD CONSTRAINT "document_entity_link_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_entity_link" ADD CONSTRAINT "document_entity_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "control_org_status_idx" ON "control" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "control_owner_idx" ON "control" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "control_type_idx" ON "control" USING btree ("org_id","control_type");--> statement-breakpoint
CREATE INDEX "ct_org_idx" ON "control_test" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ct_control_idx" ON "control_test" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "ct_campaign_idx" ON "control_test" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "ct_status_idx" ON "control_test" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ctc_org_status_idx" ON "control_test_campaign" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ctc_period_idx" ON "control_test_campaign" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "evidence_org_idx" ON "evidence" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "evidence_entity_idx" ON "evidence" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "finding_org_status_idx" ON "finding" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "finding_control_idx" ON "finding" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "finding_test_idx" ON "finding" USING btree ("control_test_id");--> statement-breakpoint
CREATE INDEX "finding_risk_idx" ON "finding" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "finding_owner_idx" ON "finding" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "finding_severity_idx" ON "finding" USING btree ("org_id","severity");--> statement-breakpoint
CREATE INDEX "ack_org_idx" ON "acknowledgment" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ack_document_idx" ON "acknowledgment" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "ack_user_idx" ON "acknowledgment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_org_status_idx" ON "document" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "document_category_idx" ON "document" USING btree ("org_id","category");--> statement-breakpoint
CREATE INDEX "document_owner_idx" ON "document" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "del_org_idx_doc" ON "document_entity_link" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "del_document_idx" ON "document_entity_link" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "del_entity_idx" ON "document_entity_link" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "dv_document_idx" ON "document_version" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "dv_org_idx" ON "document_version" USING btree ("org_id");--> statement-breakpoint

-- ============================================================
-- CUSTOM SQL: Sprint 4 — ICS + DMS Constraints, Triggers, RLS
-- Tables: control, control_test, control_test_campaign, evidence,
--         finding, document, document_version, acknowledgment,
--         document_entity_link
-- ============================================================

-- ─── 1. CHECK CONSTRAINTS ────────────────────────────────────

ALTER TABLE "control_test_campaign" ADD CONSTRAINT "ctc_period_order"
  CHECK (period_end >= period_start);--> statement-breakpoint

ALTER TABLE "control_test" ADD CONSTRAINT "ct_sample_size_positive"
  CHECK (sample_size IS NULL OR sample_size > 0);--> statement-breakpoint

ALTER TABLE "evidence" ADD CONSTRAINT "evidence_file_size_positive"
  CHECK (file_size IS NULL OR file_size > 0);--> statement-breakpoint

ALTER TABLE "acknowledgment" ADD CONSTRAINT "ack_version_positive"
  CHECK (version_acknowledged > 0);--> statement-breakpoint

ALTER TABLE "document" ADD CONSTRAINT "doc_current_version_positive"
  CHECK (current_version > 0);--> statement-breakpoint

ALTER TABLE "document_version" ADD CONSTRAINT "dv_version_positive"
  CHECK (version_number > 0);--> statement-breakpoint

-- ─── 2. FK CONSTRAINTS for Sprint 2/3 placeholder columns ───

ALTER TABLE "risk_control" ADD CONSTRAINT "risk_control_control_id_fk"
  FOREIGN KEY ("control_id") REFERENCES "public"."control"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "process_control" ADD CONSTRAINT "process_control_control_id_fk"
  FOREIGN KEY ("control_id") REFERENCES "public"."control"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "process_step_control" ADD CONSTRAINT "process_step_control_control_id_fk"
  FOREIGN KEY ("control_id") REFERENCES "public"."control"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ─── 3. set_updated_at TRIGGERS ──────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "control"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "finding"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "document"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ─── 4. ROW-LEVEL SECURITY (ADR-001) ────────────────────────

ALTER TABLE "control" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "control_test" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "control_test_campaign" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finding" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_version" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acknowledgment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_entity_link" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- org_isolation policies
CREATE POLICY org_isolation ON "control"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "control_test"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "control_test_campaign"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "evidence"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "finding"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "document"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "document_version"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "acknowledgment"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "document_entity_link"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

-- reporting_bypass policies (for cross-org reporting)
CREATE POLICY reporting_bypass ON "control"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "control_test"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "control_test_campaign"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "evidence"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "finding"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "document"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "document_version"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "acknowledgment"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "document_entity_link"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

-- ─── 5. AUDIT TRIGGERS (ADR-011) ────────────────────────────
-- NOT on evidence or acknowledgment (per spec)

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "control"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "control_test"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "control_test_campaign"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "finding"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "document"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

-- ─── 6. TRIGGER: auto-create work_item on control INSERT ────

CREATE OR REPLACE FUNCTION control_auto_create_work_item()
RETURNS TRIGGER AS $$
DECLARE
  v_wi_status work_item_status_generic;
  v_work_item_id uuid;
BEGIN
  -- Map control status to work_item status
  CASE NEW.status
    WHEN 'designed'     THEN v_wi_status := 'draft';
    WHEN 'implemented'  THEN v_wi_status := 'active';
    WHEN 'effective'    THEN v_wi_status := 'active';
    WHEN 'ineffective'  THEN v_wi_status := 'in_treatment';
    WHEN 'retired'      THEN v_wi_status := 'obsolete';
    ELSE v_wi_status := 'draft';
  END CASE;

  INSERT INTO work_item (org_id, type_key, name, status, responsible_id, created_by, updated_by)
  VALUES (NEW.org_id, 'control', NEW.title, v_wi_status, NEW.owner_id, NEW.created_by, NEW.updated_by)
  RETURNING id INTO v_work_item_id;

  NEW.work_item_id := v_work_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER control_auto_create_work_item
  BEFORE INSERT ON "control"
  FOR EACH ROW
  WHEN (NEW.work_item_id IS NULL)
  EXECUTE FUNCTION control_auto_create_work_item();--> statement-breakpoint

-- ─── 7. TRIGGER: sync work_item on control UPDATE ───────────

CREATE OR REPLACE FUNCTION control_sync_work_item()
RETURNS TRIGGER AS $$
DECLARE
  v_wi_status work_item_status_generic;
BEGIN
  IF NEW.work_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title OR OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'designed'     THEN v_wi_status := 'draft';
      WHEN 'implemented'  THEN v_wi_status := 'active';
      WHEN 'effective'    THEN v_wi_status := 'active';
      WHEN 'ineffective'  THEN v_wi_status := 'in_treatment';
      WHEN 'retired'      THEN v_wi_status := 'obsolete';
      ELSE v_wi_status := 'draft';
    END CASE;

    UPDATE work_item
    SET name = NEW.title,
        status = v_wi_status,
        updated_at = now(),
        updated_by = NEW.updated_by
    WHERE id = NEW.work_item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER control_sync_work_item
  AFTER UPDATE ON "control"
  FOR EACH ROW EXECUTE FUNCTION control_sync_work_item();--> statement-breakpoint

-- ─── 8. TRIGGER: auto-create work_item on finding INSERT ────

CREATE OR REPLACE FUNCTION finding_auto_create_work_item()
RETURNS TRIGGER AS $$
DECLARE
  v_wi_status work_item_status_generic;
  v_work_item_id uuid;
BEGIN
  CASE NEW.status
    WHEN 'identified'     THEN v_wi_status := 'draft';
    WHEN 'in_remediation' THEN v_wi_status := 'in_treatment';
    WHEN 'remediated'     THEN v_wi_status := 'in_review';
    WHEN 'verified'       THEN v_wi_status := 'in_approval';
    WHEN 'accepted'       THEN v_wi_status := 'management_approved';
    WHEN 'closed'         THEN v_wi_status := 'completed';
    ELSE v_wi_status := 'draft';
  END CASE;

  INSERT INTO work_item (org_id, type_key, name, status, responsible_id, created_by, updated_by)
  VALUES (NEW.org_id, 'finding', NEW.title, v_wi_status, NEW.owner_id, NEW.created_by, NEW.updated_by)
  RETURNING id INTO v_work_item_id;

  NEW.work_item_id := v_work_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER finding_auto_create_work_item
  BEFORE INSERT ON "finding"
  FOR EACH ROW
  WHEN (NEW.work_item_id IS NULL)
  EXECUTE FUNCTION finding_auto_create_work_item();--> statement-breakpoint

-- ─── 9. TRIGGER: sync work_item on finding UPDATE ───────────

CREATE OR REPLACE FUNCTION finding_sync_work_item()
RETURNS TRIGGER AS $$
DECLARE
  v_wi_status work_item_status_generic;
BEGIN
  IF NEW.work_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title OR OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'identified'     THEN v_wi_status := 'draft';
      WHEN 'in_remediation' THEN v_wi_status := 'in_treatment';
      WHEN 'remediated'     THEN v_wi_status := 'in_review';
      WHEN 'verified'       THEN v_wi_status := 'in_approval';
      WHEN 'accepted'       THEN v_wi_status := 'management_approved';
      WHEN 'closed'         THEN v_wi_status := 'completed';
      ELSE v_wi_status := 'draft';
    END CASE;

    UPDATE work_item
    SET name = NEW.title,
        status = v_wi_status,
        updated_at = now(),
        updated_by = NEW.updated_by
    WHERE id = NEW.work_item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER finding_sync_work_item
  AFTER UPDATE ON "finding"
  FOR EACH ROW EXECUTE FUNCTION finding_sync_work_item();