CREATE TYPE "public"."audit_conclusion" AS ENUM('conforming', 'minor_nonconformity', 'major_nonconformity', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."audit_plan_status" AS ENUM('draft', 'approved', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('planned', 'preparation', 'fieldwork', 'reporting', 'review', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_type" AS ENUM('internal', 'external', 'certification', 'surveillance', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."checklist_result" AS ENUM('conforming', 'nonconforming', 'observation', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."checklist_source_type" AS ENUM('auto_controls', 'template', 'custom');--> statement-breakpoint
CREATE TYPE "public"."universe_entity_type" AS ENUM('process', 'department', 'it_system', 'vendor', 'custom');--> statement-breakpoint
CREATE TABLE "audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"audit_plan_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"audit_type" "audit_type" DEFAULT 'internal' NOT NULL,
	"status" "audit_status" DEFAULT 'planned' NOT NULL,
	"scope_description" text,
	"scope_processes" text[],
	"scope_departments" text[],
	"scope_frameworks" text[],
	"lead_auditor_id" uuid,
	"auditor_ids" uuid[],
	"auditee_id" uuid,
	"planned_start" date,
	"planned_end" date,
	"actual_start" date,
	"actual_end" date,
	"finding_count" integer DEFAULT 0,
	"conclusion" "audit_conclusion",
	"report_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"activity_type" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"performed_by" uuid,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"source_type" "checklist_source_type",
	"total_items" integer DEFAULT 0,
	"completed_items" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_checklist_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"control_id" uuid,
	"question" text NOT NULL,
	"expected_evidence" text,
	"result" "checklist_result",
	"notes" text,
	"evidence_ids" uuid[],
	"sort_order" integer DEFAULT 0,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"evidence_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"file_path" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"year" integer NOT NULL,
	"description" text,
	"status" "audit_plan_status" DEFAULT 'draft' NOT NULL,
	"total_planned_days" integer,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_plan_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"audit_plan_id" uuid NOT NULL,
	"universe_entry_id" uuid,
	"title" varchar(500) NOT NULL,
	"scope_description" text,
	"planned_start" date,
	"planned_end" date,
	"estimated_days" integer,
	"lead_auditor_id" uuid,
	"status" varchar(50) DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_universe_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"entity_type" "universe_entity_type" NOT NULL,
	"entity_id" uuid,
	"risk_score" integer,
	"last_audit_date" date,
	"audit_cycle_months" integer DEFAULT 12,
	"next_audit_due" date,
	"priority" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_audit_plan_item_id_audit_plan_item_id_fk" FOREIGN KEY ("audit_plan_item_id") REFERENCES "public"."audit_plan_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_lead_auditor_id_user_id_fk" FOREIGN KEY ("lead_auditor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_auditee_id_user_id_fk" FOREIGN KEY ("auditee_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_activity" ADD CONSTRAINT "audit_activity_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_activity" ADD CONSTRAINT "audit_activity_audit_id_audit_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_activity" ADD CONSTRAINT "audit_activity_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_checklist" ADD CONSTRAINT "audit_checklist_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_checklist" ADD CONSTRAINT "audit_checklist_audit_id_audit_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_checklist" ADD CONSTRAINT "audit_checklist_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_checklist_item" ADD CONSTRAINT "audit_checklist_item_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_checklist_item" ADD CONSTRAINT "audit_checklist_item_checklist_id_audit_checklist_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."audit_checklist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_checklist_item" ADD CONSTRAINT "audit_checklist_item_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_checklist_item" ADD CONSTRAINT "audit_checklist_item_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_audit_id_audit_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_plan" ADD CONSTRAINT "audit_plan_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_plan" ADD CONSTRAINT "audit_plan_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_plan" ADD CONSTRAINT "audit_plan_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_plan_item" ADD CONSTRAINT "audit_plan_item_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_plan_item" ADD CONSTRAINT "audit_plan_item_audit_plan_id_audit_plan_id_fk" FOREIGN KEY ("audit_plan_id") REFERENCES "public"."audit_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_plan_item" ADD CONSTRAINT "audit_plan_item_universe_entry_id_audit_universe_entry_id_fk" FOREIGN KEY ("universe_entry_id") REFERENCES "public"."audit_universe_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_plan_item" ADD CONSTRAINT "audit_plan_item_lead_auditor_id_user_id_fk" FOREIGN KEY ("lead_auditor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_universe_entry" ADD CONSTRAINT "audit_universe_entry_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_universe_entry" ADD CONSTRAINT "audit_universe_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_status_idx" ON "audit" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "audit_org_type_idx" ON "audit" USING btree ("org_id","audit_type");--> statement-breakpoint
CREATE INDEX "audit_lead_idx" ON "audit" USING btree ("lead_auditor_id");--> statement-breakpoint
CREATE INDEX "audit_plan_item_idx" ON "audit" USING btree ("audit_plan_item_id");--> statement-breakpoint
CREATE INDEX "aa_audit_idx" ON "audit_activity" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "aa_org_idx" ON "audit_activity" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "acl_audit_idx" ON "audit_checklist" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "acl_org_idx" ON "audit_checklist" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "aci_checklist_idx" ON "audit_checklist_item" USING btree ("checklist_id");--> statement-breakpoint
CREATE INDEX "aci_org_idx" ON "audit_checklist_item" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "aci_control_idx" ON "audit_checklist_item" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "ae_audit_idx" ON "audit_evidence" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "ae_org_idx" ON "audit_evidence" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ap_org_year_idx" ON "audit_plan" USING btree ("org_id","year");--> statement-breakpoint
CREATE INDEX "ap_org_status_idx" ON "audit_plan" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "api_plan_idx" ON "audit_plan_item" USING btree ("audit_plan_id");--> statement-breakpoint
CREATE INDEX "api_org_idx" ON "audit_plan_item" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "aue_org_idx" ON "audit_universe_entry" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "aue_entity_type_idx" ON "audit_universe_entry" USING btree ("org_id","entity_type");--> statement-breakpoint
CREATE INDEX "aue_next_due_idx" ON "audit_universe_entry" USING btree ("org_id","next_audit_due");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- Post-migration: RLS, Triggers, FK additions
-- ──────────────────────────────────────────────────────────────

-- ─── 1. Add audit_id FK to finding table ─────────────────────
ALTER TABLE "finding" ADD COLUMN IF NOT EXISTS "audit_id" uuid REFERENCES "audit"("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finding_audit_idx" ON "finding" ("audit_id");--> statement-breakpoint

-- ─── 2. RLS on all 8 audit management tables ────────────────
ALTER TABLE "audit_universe_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_plan_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_checklist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_checklist_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- RLS Policies (org_id isolation)
CREATE POLICY "audit_universe_entry_org_isolation" ON "audit_universe_entry"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_plan_org_isolation" ON "audit_plan"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_plan_item_org_isolation" ON "audit_plan_item"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_org_isolation" ON "audit"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_activity_org_isolation" ON "audit_activity"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_checklist_org_isolation" ON "audit_checklist"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_checklist_item_org_isolation" ON "audit_checklist_item"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_evidence_org_isolation" ON "audit_evidence"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

-- ─── 3. set_updated_at TRIGGERS ──────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "audit_universe_entry"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "audit"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "audit_plan"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ─── 4. Audit log triggers ──────────────────────────────────
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "audit"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "audit_plan"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "audit_checklist"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

-- ─── 5. TRIGGER: auto-create work_item on audit INSERT ──────

CREATE OR REPLACE FUNCTION audit_auto_create_work_item()
RETURNS TRIGGER AS $$
DECLARE
  v_wi_status work_item_status_generic;
  v_work_item_id uuid;
BEGIN
  CASE NEW.status
    WHEN 'planned'     THEN v_wi_status := 'draft';
    WHEN 'preparation' THEN v_wi_status := 'in_evaluation';
    WHEN 'fieldwork'   THEN v_wi_status := 'active';
    WHEN 'reporting'   THEN v_wi_status := 'in_review';
    WHEN 'review'      THEN v_wi_status := 'in_approval';
    WHEN 'completed'   THEN v_wi_status := 'completed';
    WHEN 'cancelled'   THEN v_wi_status := 'cancelled';
    ELSE v_wi_status := 'draft';
  END CASE;

  INSERT INTO work_item (org_id, type_key, name, status, responsible_id, created_by, updated_by)
  VALUES (NEW.org_id, 'audit', NEW.title, v_wi_status, NEW.lead_auditor_id, NEW.created_by, NEW.created_by)
  RETURNING id INTO v_work_item_id;

  NEW.work_item_id := v_work_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER audit_auto_create_work_item
  BEFORE INSERT ON "audit"
  FOR EACH ROW
  WHEN (NEW.work_item_id IS NULL)
  EXECUTE FUNCTION audit_auto_create_work_item();--> statement-breakpoint

-- ─── 6. TRIGGER: sync work_item on audit UPDATE ─────────────

CREATE OR REPLACE FUNCTION audit_sync_work_item()
RETURNS TRIGGER AS $$
DECLARE
  v_wi_status work_item_status_generic;
BEGIN
  IF NEW.work_item_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'planned'     THEN v_wi_status := 'draft';
    WHEN 'preparation' THEN v_wi_status := 'in_evaluation';
    WHEN 'fieldwork'   THEN v_wi_status := 'active';
    WHEN 'reporting'   THEN v_wi_status := 'in_review';
    WHEN 'review'      THEN v_wi_status := 'in_approval';
    WHEN 'completed'   THEN v_wi_status := 'completed';
    WHEN 'cancelled'   THEN v_wi_status := 'cancelled';
    ELSE v_wi_status := 'draft';
  END CASE;

  UPDATE work_item
  SET name = NEW.title,
      status = v_wi_status,
      responsible_id = NEW.lead_auditor_id,
      updated_at = NOW()
  WHERE id = NEW.work_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER audit_sync_work_item
  AFTER UPDATE ON "audit"
  FOR EACH ROW EXECUTE FUNCTION audit_sync_work_item();