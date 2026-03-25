CREATE TYPE "public"."asset_tier" AS ENUM('business_structure', 'primary_asset', 'supporting_asset');--> statement-breakpoint
CREATE TYPE "public"."work_item_status_generic" AS ENUM('draft', 'in_evaluation', 'in_review', 'in_approval', 'management_approved', 'active', 'in_treatment', 'completed', 'obsolete', 'cancelled');--> statement-breakpoint
CREATE TABLE "asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"asset_tier" "asset_tier" DEFAULT 'supporting_asset' NOT NULL,
	"code_group" varchar(100),
	"default_confidentiality" integer,
	"default_integrity" integer,
	"default_availability" integer,
	"default_authenticity" integer,
	"default_reliability" integer,
	"protection_goal_class" integer,
	"contact_person" varchar(255),
	"data_protection_responsible" varchar(255),
	"dpo_email" varchar(255),
	"latest_audit_date" date,
	"latest_audit_result" varchar(50),
	"parent_asset_id" uuid,
	"visible_in_modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "asset_cia_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"assessment_run_id" uuid,
	"confidentiality" integer NOT NULL,
	"integrity" integer NOT NULL,
	"availability" integer NOT NULL,
	"authenticity" integer,
	"reliability" integer,
	"protection_goal_class" integer,
	"is_assessment_required" boolean DEFAULT false,
	"overrule_justification" text,
	"valid_from" date DEFAULT now() NOT NULL,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "work_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type_key" varchar(50) NOT NULL,
	"element_id" varchar(20),
	"name" varchar(500) NOT NULL,
	"status" "work_item_status_generic" DEFAULT 'draft' NOT NULL,
	"responsible_id" uuid,
	"reviewer_id" uuid,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"grc_perspective" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "work_item_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"link_type" varchar(50) DEFAULT 'related' NOT NULL,
	"link_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "work_item_type" (
	"type_key" varchar(50) PRIMARY KEY NOT NULL,
	"display_name_de" varchar(100) NOT NULL,
	"display_name_en" varchar(100) NOT NULL,
	"icon" varchar(50),
	"color_class" varchar(50),
	"primary_module" varchar(50) NOT NULL,
	"secondary_modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"has_status_workflow" boolean DEFAULT true NOT NULL,
	"has_responsible_user" boolean DEFAULT true NOT NULL,
	"has_due_date" boolean DEFAULT false NOT NULL,
	"has_priority" boolean DEFAULT false NOT NULL,
	"has_linked_asset" boolean DEFAULT false NOT NULL,
	"has_cia_evaluation" boolean DEFAULT false NOT NULL,
	"is_cross_module" boolean DEFAULT false NOT NULL,
	"status_enum_name" varchar(50),
	"data_table" varchar(100),
	"data_fk_column" varchar(50),
	"element_id_prefix" varchar(3),
	"nav_order" integer NOT NULL,
	"is_active_in_platform" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "work_item_id" uuid;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_cia_profile" ADD CONSTRAINT "asset_cia_profile_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_cia_profile" ADD CONSTRAINT "asset_cia_profile_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_type_key_work_item_type_type_key_fk" FOREIGN KEY ("type_key") REFERENCES "public"."work_item_type"("type_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_link" ADD CONSTRAINT "work_item_link_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_link" ADD CONSTRAINT "work_item_link_source_id_work_item_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."work_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_link" ADD CONSTRAINT "work_item_link_target_id_work_item_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."work_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_link" ADD CONSTRAINT "work_item_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_parent_idx" ON "asset" USING btree ("parent_asset_id");--> statement-breakpoint
CREATE INDEX "asset_tier_org_idx" ON "asset" USING btree ("org_id","asset_tier");--> statement-breakpoint
CREATE INDEX "asset_cia_profile_asset_idx" ON "asset_cia_profile" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "work_item_org_type_idx" ON "work_item" USING btree ("org_id","type_key");--> statement-breakpoint
CREATE INDEX "work_item_org_status_idx" ON "work_item" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "work_item_responsible_idx" ON "work_item" USING btree ("responsible_id");--> statement-breakpoint
CREATE INDEX "work_item_link_source_idx" ON "work_item_link" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "work_item_link_target_idx" ON "work_item_link" USING btree ("target_id");--> statement-breakpoint

-- ============================================================
-- CUSTOM SQL: Sprint 1.4 — Constraints, Triggers, RLS, Seeds
-- Asset 3-tier model, Work Item base entity, Element ID trigger
-- ============================================================

-- ─── 1. SELF-REFERENCE FK: asset.parent_asset_id → asset.id ──
ALTER TABLE "asset" ADD CONSTRAINT "asset_parent_asset_id_fk"
  FOREIGN KEY ("parent_asset_id") REFERENCES "public"."asset"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;--> statement-breakpoint

-- ─── 2. FK: task.work_item_id → work_item.id ──
ALTER TABLE "task" ADD CONSTRAINT "task_work_item_id_fk"
  FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;--> statement-breakpoint

-- ─── 3. CHECK CONSTRAINTS: CIA columns (1–4 scale) ──
ALTER TABLE "asset" ADD CONSTRAINT "asset_confidentiality_range"
  CHECK (default_confidentiality IS NULL OR (default_confidentiality BETWEEN 1 AND 4));--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_integrity_range"
  CHECK (default_integrity IS NULL OR (default_integrity BETWEEN 1 AND 4));--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_availability_range"
  CHECK (default_availability IS NULL OR (default_availability BETWEEN 1 AND 4));--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_authenticity_range"
  CHECK (default_authenticity IS NULL OR (default_authenticity BETWEEN 1 AND 4));--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_reliability_range"
  CHECK (default_reliability IS NULL OR (default_reliability BETWEEN 1 AND 4));--> statement-breakpoint

ALTER TABLE "asset_cia_profile" ADD CONSTRAINT "cia_confidentiality_range"
  CHECK (confidentiality BETWEEN 1 AND 4);--> statement-breakpoint
ALTER TABLE "asset_cia_profile" ADD CONSTRAINT "cia_integrity_range"
  CHECK (integrity BETWEEN 1 AND 4);--> statement-breakpoint
ALTER TABLE "asset_cia_profile" ADD CONSTRAINT "cia_availability_range"
  CHECK (availability BETWEEN 1 AND 4);--> statement-breakpoint
ALTER TABLE "asset_cia_profile" ADD CONSTRAINT "cia_authenticity_range"
  CHECK (authenticity IS NULL OR (authenticity BETWEEN 1 AND 4));--> statement-breakpoint
ALTER TABLE "asset_cia_profile" ADD CONSTRAINT "cia_reliability_range"
  CHECK (reliability IS NULL OR (reliability BETWEEN 1 AND 4));--> statement-breakpoint

-- ─── 4. UNIQUE + CHECK on work_item_link ──
ALTER TABLE "work_item_link" ADD CONSTRAINT "work_item_link_unique_triple"
  UNIQUE (source_id, target_id, link_type);--> statement-breakpoint
ALTER TABLE "work_item_link" ADD CONSTRAINT "work_item_link_no_self_ref"
  CHECK (source_id != target_id);--> statement-breakpoint

-- ─── 5. TRIGGER: update_protection_goal_class on asset ──
CREATE OR REPLACE FUNCTION update_asset_protection_goal_class()
RETURNS TRIGGER AS $$
BEGIN
  NEW.protection_goal_class := GREATEST(
    COALESCE(NEW.default_confidentiality, 0),
    COALESCE(NEW.default_integrity, 0),
    COALESCE(NEW.default_availability, 0)
  );
  -- If all three are NULL, keep NULL
  IF NEW.default_confidentiality IS NULL
     AND NEW.default_integrity IS NULL
     AND NEW.default_availability IS NULL THEN
    NEW.protection_goal_class := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER update_protection_goal_class
  BEFORE INSERT OR UPDATE ON "asset"
  FOR EACH ROW EXECUTE FUNCTION update_asset_protection_goal_class();--> statement-breakpoint

-- ─── 6. TRIGGER: update_protection_goal_class on asset_cia_profile ──
CREATE OR REPLACE FUNCTION update_cia_profile_protection_goal_class()
RETURNS TRIGGER AS $$
BEGIN
  NEW.protection_goal_class := GREATEST(
    COALESCE(NEW.confidentiality, 0),
    COALESCE(NEW.integrity, 0),
    COALESCE(NEW.availability, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER update_cia_profile_protection_goal_class
  BEFORE INSERT OR UPDATE ON "asset_cia_profile"
  FOR EACH ROW EXECUTE FUNCTION update_cia_profile_protection_goal_class();--> statement-breakpoint

-- ─── 7. TRIGGER: generate_work_item_element_id ──
-- Generates element IDs like "RSK-001", "CTL-042" based on prefix + per-org sequence
CREATE OR REPLACE FUNCTION generate_work_item_element_id()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix varchar(3);
  v_seq    integer;
BEGIN
  -- Get prefix from work_item_type
  SELECT element_id_prefix INTO v_prefix
  FROM work_item_type
  WHERE type_key = NEW.type_key;

  IF v_prefix IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count existing items of same type in this org + 1
  SELECT COUNT(*) + 1 INTO v_seq
  FROM work_item
  WHERE org_id = NEW.org_id AND type_key = NEW.type_key;

  NEW.element_id := v_prefix || '-' || LPAD(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER generate_work_item_element_id
  BEFORE INSERT ON "work_item"
  FOR EACH ROW EXECUTE FUNCTION generate_work_item_element_id();--> statement-breakpoint

-- ─── 8. set_updated_at TRIGGERS for new tables ──
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "asset"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "asset_cia_profile"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "work_item"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ─── 9. ROW-LEVEL SECURITY for new tables (ADR-001) ──
ALTER TABLE "asset" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "asset_cia_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_item_link" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY org_isolation ON "asset"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "asset_cia_profile"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "work_item"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "work_item_link"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

-- ─── 10. AUDIT TRIGGERS for new business tables (ADR-011) ──
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "asset"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "work_item"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "work_item_link"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

-- ─── 11. SEED: work_item_type (18 types from PRD §032) ──
INSERT INTO work_item_type (
  type_key, display_name_de, display_name_en, icon, color_class,
  primary_module, secondary_modules, has_status_workflow, has_responsible_user,
  has_due_date, has_priority, has_linked_asset, has_cia_evaluation,
  is_cross_module, status_enum_name, data_table, data_fk_column,
  element_id_prefix, nav_order, is_active_in_platform
) VALUES
  ('risk', 'Risiko', 'Risk', 'AlertTriangle', 'text-red-600',
   'erm', '{}', true, true, false, true, true, true,
   true, 'risk_status', 'risk', 'work_item_id', 'RSK', 1, true),

  ('control', 'Kontrolle', 'Control', 'Shield', 'text-blue-600',
   'ics', '{erm,isms}', true, true, false, false, true, false,
   true, 'control_status', 'control', 'work_item_id', 'CTL', 2, true),

  ('audit_finding', 'Auditfeststellung', 'Audit Finding', 'Search', 'text-amber-600',
   'audit', '{}', true, true, true, true, false, false,
   false, NULL, 'audit_finding', 'work_item_id', 'AUF', 3, true),

  ('audit_action', 'Auditmaßnahme', 'Audit Action', 'CheckCircle', 'text-green-600',
   'audit', '{}', true, true, true, true, false, false,
   false, NULL, 'audit_action', 'work_item_id', 'AUA', 4, true),

  ('process', 'Prozess', 'Process', 'GitBranch', 'text-purple-600',
   'bpm', '{}', true, true, false, false, true, false,
   true, 'process_status', 'process', 'work_item_id', 'PRZ', 5, true),

  ('document', 'Dokument', 'Document', 'FileText', 'text-gray-600',
   'dms', '{}', true, true, true, false, false, false,
   true, 'document_status', 'document', 'work_item_id', 'DOK', 6, true),

  ('policy', 'Richtlinie', 'Policy', 'BookOpen', 'text-indigo-600',
   'dms', '{isms,ics}', true, true, true, false, false, false,
   true, 'policy_status', 'policy', 'work_item_id', 'POL', 7, true),

  ('isms_statement', 'ISMS-Erklärung', 'ISMS Statement of Applicability', 'ClipboardList', 'text-cyan-600',
   'isms', '{}', true, true, false, false, true, true,
   false, NULL, 'isms_soa', 'work_item_id', 'SOA', 8, true),

  ('bcm_plan', 'BCM-Plan', 'BCM Plan', 'Umbrella', 'text-orange-600',
   'bcms', '{}', true, true, true, true, true, true,
   false, NULL, 'bcm_plan', 'work_item_id', 'BCP', 9, true),

  ('bia', 'Geschäftsauswirkungsanalyse', 'Business Impact Analysis', 'BarChart3', 'text-rose-600',
   'bcms', '{}', true, true, true, false, true, true,
   false, NULL, 'bia', 'work_item_id', 'BIA', 10, true),

  ('dpia', 'Datenschutz-Folgenabschätzung', 'Data Protection Impact Assessment', 'Eye', 'text-violet-600',
   'dpms', '{}', true, true, true, true, true, true,
   false, NULL, 'dpia', 'work_item_id', 'DFA', 11, true),

  ('processing_activity', 'Verarbeitungstätigkeit', 'Processing Activity', 'Database', 'text-teal-600',
   'dpms', '{}', true, true, false, false, true, false,
   false, NULL, 'processing_activity', 'work_item_id', 'VVT', 12, true),

  ('vendor', 'Dienstleister', 'Vendor', 'Building2', 'text-stone-600',
   'tprm', '{}', true, true, true, true, true, true,
   false, NULL, 'vendor', 'work_item_id', 'VND', 13, true),

  ('contract', 'Vertrag', 'Contract', 'FileSignature', 'text-emerald-600',
   'contract', '{}', true, true, true, false, false, false,
   false, NULL, 'contract', 'work_item_id', 'VTR', 14, true),

  ('esg_measure', 'ESG-Maßnahme', 'ESG Measure', 'Leaf', 'text-lime-600',
   'esg', '{}', true, true, true, true, false, false,
   false, NULL, 'esg_measure', 'work_item_id', 'ESG', 15, true),

  ('incident', 'Vorfall', 'Incident', 'Siren', 'text-red-500',
   'erm', '{isms,bcms}', true, true, true, true, true, false,
   true, NULL, 'incident', 'work_item_id', 'INC', 16, true),

  ('exception', 'Ausnahme', 'Exception', 'ShieldOff', 'text-yellow-600',
   'ics', '{erm,isms}', true, true, true, true, true, false,
   true, NULL, 'exception', 'work_item_id', 'EXC', 17, true),

  ('whistleblower_case', 'Hinweisgeberfall', 'Whistleblower Case', 'MessageSquareWarning', 'text-pink-600',
   'whistleblowing', '{}', true, true, true, true, false, false,
   false, NULL, 'whistleblower_case', 'work_item_id', 'HWG', 18, true)
ON CONFLICT (type_key) DO NOTHING;