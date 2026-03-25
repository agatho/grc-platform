CREATE TYPE "public"."kri_alert_status" AS ENUM('green', 'yellow', 'red');--> statement-breakpoint
CREATE TYPE "public"."kri_direction" AS ENUM('asc', 'desc');--> statement-breakpoint
CREATE TYPE "public"."kri_measurement_frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly');--> statement-breakpoint
CREATE TYPE "public"."kri_measurement_source" AS ENUM('manual', 'api_import', 'calculated');--> statement-breakpoint
CREATE TYPE "public"."kri_trend" AS ENUM('improving', 'stable', 'worsening');--> statement-breakpoint
CREATE TYPE "public"."risk_category" AS ENUM('strategic', 'operational', 'financial', 'compliance', 'cyber', 'reputational', 'esg');--> statement-breakpoint
CREATE TYPE "public"."risk_source" AS ENUM('isms', 'erm', 'bcm', 'project', 'process');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('identified', 'assessed', 'treated', 'accepted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."treatment_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."treatment_strategy" AS ENUM('mitigate', 'accept', 'transfer', 'avoid');--> statement-breakpoint
CREATE TABLE "kri" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"unit" varchar(50),
	"direction" "kri_direction" NOT NULL,
	"threshold_green" numeric(15, 2),
	"threshold_yellow" numeric(15, 2),
	"threshold_red" numeric(15, 2),
	"current_value" numeric(15, 2),
	"current_alert_status" "kri_alert_status" DEFAULT 'green' NOT NULL,
	"trend" "kri_trend" DEFAULT 'stable' NOT NULL,
	"measurement_frequency" "kri_measurement_frequency" DEFAULT 'monthly' NOT NULL,
	"last_measured_at" timestamp with time zone,
	"alert_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "kri_measurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kri_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"value" numeric(15, 2) NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"source" "kri_measurement_source" DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_risk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"risk_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "process_step_risk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" uuid NOT NULL,
	"process_step_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "risk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_item_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"risk_category" "risk_category" NOT NULL,
	"risk_source" "risk_source" NOT NULL,
	"status" "risk_status" DEFAULT 'identified' NOT NULL,
	"owner_id" uuid,
	"department" varchar(255),
	"inherent_likelihood" integer,
	"inherent_impact" integer,
	"residual_likelihood" integer,
	"residual_impact" integer,
	"risk_score_inherent" integer,
	"risk_score_residual" integer,
	"treatment_strategy" "treatment_strategy",
	"treatment_rationale" text,
	"financial_impact_min" numeric(15, 2),
	"financial_impact_max" numeric(15, 2),
	"financial_impact_expected" numeric(15, 2),
	"risk_appetite_exceeded" boolean DEFAULT false NOT NULL,
	"review_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "risk_appetite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"appetite_threshold" integer NOT NULL,
	"tolerance_upper" numeric,
	"tolerance_lower" numeric,
	"description" text,
	"effective_date" date DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "risk_appetite_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "risk_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "risk_control" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"effectiveness" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "risk_framework_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "risk_framework_mapping_unique" UNIQUE("risk_id","requirement_id")
);
--> statement-breakpoint
CREATE TABLE "risk_treatment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" uuid NOT NULL,
	"work_item_id" uuid,
	"description" text,
	"responsible_id" uuid,
	"expected_risk_reduction" numeric(5, 2),
	"cost_estimate" numeric(15, 2),
	"status" "treatment_status" DEFAULT 'planned' NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "simulation_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risk_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"simulation_run_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"simulated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"p5" numeric(15, 2),
	"p25" numeric(15, 2),
	"p50" numeric(15, 2),
	"p75" numeric(15, 2),
	"p95" numeric(15, 2),
	"iterations" integer,
	"model" varchar(100)
);
--> statement-breakpoint
ALTER TABLE "kri" ADD CONSTRAINT "kri_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kri" ADD CONSTRAINT "kri_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kri_measurement" ADD CONSTRAINT "kri_measurement_kri_id_kri_id_fk" FOREIGN KEY ("kri_id") REFERENCES "public"."kri"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kri_measurement" ADD CONSTRAINT "kri_measurement_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kri_measurement" ADD CONSTRAINT "kri_measurement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_risk" ADD CONSTRAINT "process_risk_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_risk" ADD CONSTRAINT "process_risk_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_risk" ADD CONSTRAINT "process_risk_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_risk" ADD CONSTRAINT "process_step_risk_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_risk" ADD CONSTRAINT "process_step_risk_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_step_risk" ADD CONSTRAINT "process_step_risk_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk" ADD CONSTRAINT "risk_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk" ADD CONSTRAINT "risk_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk" ADD CONSTRAINT "risk_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_appetite" ADD CONSTRAINT "risk_appetite_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_asset" ADD CONSTRAINT "risk_asset_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_asset" ADD CONSTRAINT "risk_asset_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_asset" ADD CONSTRAINT "risk_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_asset" ADD CONSTRAINT "risk_asset_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_control" ADD CONSTRAINT "risk_control_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_control" ADD CONSTRAINT "risk_control_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_control" ADD CONSTRAINT "risk_control_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_framework_mapping" ADD CONSTRAINT "risk_framework_mapping_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_framework_mapping" ADD CONSTRAINT "risk_framework_mapping_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_framework_mapping" ADD CONSTRAINT "risk_framework_mapping_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_treatment" ADD CONSTRAINT "risk_treatment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_treatment" ADD CONSTRAINT "risk_treatment_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_treatment" ADD CONSTRAINT "risk_treatment_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_treatment" ADD CONSTRAINT "risk_treatment_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_result" ADD CONSTRAINT "simulation_result_risk_id_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_result" ADD CONSTRAINT "simulation_result_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kri_org_idx" ON "kri" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "kri_risk_idx" ON "kri" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "kri_measurement_kri_at_idx" ON "kri_measurement" USING btree ("kri_id","measured_at");--> statement-breakpoint
CREATE INDEX "kri_measurement_org_at_idx" ON "kri_measurement" USING btree ("org_id","measured_at");--> statement-breakpoint
CREATE INDEX "process_risk_org_idx" ON "process_risk" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "process_risk_risk_idx" ON "process_risk" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "process_risk_process_idx" ON "process_risk" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_step_risk_org_idx" ON "process_step_risk" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "process_step_risk_risk_idx" ON "process_step_risk" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "risk_org_status_idx" ON "risk" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "risk_owner_idx" ON "risk" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "risk_score_residual_idx" ON "risk" USING btree ("risk_score_residual");--> statement-breakpoint
CREATE INDEX "risk_org_appetite_exceeded_idx" ON "risk" USING btree ("org_id","risk_appetite_exceeded");--> statement-breakpoint
CREATE INDEX "risk_appetite_org_idx" ON "risk_appetite" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "risk_asset_org_idx" ON "risk_asset" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "risk_asset_risk_idx" ON "risk_asset" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "risk_asset_asset_idx" ON "risk_asset" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "risk_control_org_idx" ON "risk_control" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "risk_control_risk_idx" ON "risk_control" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "risk_control_control_idx" ON "risk_control" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "rfm_org_idx" ON "risk_framework_mapping" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rfm_risk_idx" ON "risk_framework_mapping" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "risk_treatment_risk_idx" ON "risk_treatment" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "risk_treatment_org_idx" ON "risk_treatment" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "risk_treatment_responsible_idx" ON "risk_treatment" USING btree ("responsible_id");--> statement-breakpoint
CREATE INDEX "sim_result_risk_idx" ON "simulation_result" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "sim_result_org_idx" ON "simulation_result" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sim_result_run_idx" ON "simulation_result" USING btree ("simulation_run_id");--> statement-breakpoint

-- ============================================================
-- CUSTOM SQL: Sprint 2 — ERM Constraints, Triggers, RLS
-- Risk management tables: risk, risk_treatment, kri, kri_measurement,
-- risk_appetite, simulation_result, join tables
-- ============================================================

-- ─── 1. CHECK CONSTRAINTS: likelihood/impact (1-5 scale) ────

ALTER TABLE "risk" ADD CONSTRAINT "risk_inherent_likelihood_range"
  CHECK (inherent_likelihood IS NULL OR (inherent_likelihood BETWEEN 1 AND 5));--> statement-breakpoint
ALTER TABLE "risk" ADD CONSTRAINT "risk_inherent_impact_range"
  CHECK (inherent_impact IS NULL OR (inherent_impact BETWEEN 1 AND 5));--> statement-breakpoint
ALTER TABLE "risk" ADD CONSTRAINT "risk_residual_likelihood_range"
  CHECK (residual_likelihood IS NULL OR (residual_likelihood BETWEEN 1 AND 5));--> statement-breakpoint
ALTER TABLE "risk" ADD CONSTRAINT "risk_residual_impact_range"
  CHECK (residual_impact IS NULL OR (residual_impact BETWEEN 1 AND 5));--> statement-breakpoint

-- appetite_threshold (1-25)
ALTER TABLE "risk_appetite" ADD CONSTRAINT "risk_appetite_threshold_range"
  CHECK (appetite_threshold BETWEEN 1 AND 25);--> statement-breakpoint

-- ─── 2. TRIGGER: compute risk_score_inherent and risk_score_residual ──

CREATE OR REPLACE FUNCTION compute_risk_scores()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute inherent score
  IF NEW.inherent_likelihood IS NOT NULL AND NEW.inherent_impact IS NOT NULL THEN
    NEW.risk_score_inherent := NEW.inherent_likelihood * NEW.inherent_impact;
  ELSE
    NEW.risk_score_inherent := NULL;
  END IF;

  -- Compute residual score
  IF NEW.residual_likelihood IS NOT NULL AND NEW.residual_impact IS NOT NULL THEN
    NEW.risk_score_residual := NEW.residual_likelihood * NEW.residual_impact;
  ELSE
    NEW.risk_score_residual := NULL;
  END IF;

  -- Check if risk appetite exceeded
  IF NEW.risk_score_inherent IS NOT NULL THEN
    DECLARE
      v_threshold integer;
    BEGIN
      SELECT appetite_threshold INTO v_threshold
      FROM risk_appetite
      WHERE org_id = NEW.org_id AND deleted_at IS NULL
      LIMIT 1;

      IF v_threshold IS NOT NULL THEN
        NEW.risk_appetite_exceeded := COALESCE(NEW.risk_score_residual, NEW.risk_score_inherent) > v_threshold;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER compute_risk_scores
  BEFORE INSERT OR UPDATE ON "risk"
  FOR EACH ROW EXECUTE FUNCTION compute_risk_scores();--> statement-breakpoint

-- ─── 3. TRIGGER: auto-create work_item on risk INSERT ────────

CREATE OR REPLACE FUNCTION risk_auto_create_work_item()
RETURNS TRIGGER AS $$
DECLARE
  v_wi_status work_item_status_generic;
  v_work_item_id uuid;
BEGIN
  -- Map risk status to work_item status
  CASE NEW.status
    WHEN 'identified' THEN v_wi_status := 'draft';
    WHEN 'assessed'   THEN v_wi_status := 'in_evaluation';
    WHEN 'treated'    THEN v_wi_status := 'in_treatment';
    WHEN 'accepted'   THEN v_wi_status := 'management_approved';
    WHEN 'closed'     THEN v_wi_status := 'completed';
    ELSE v_wi_status := 'draft';
  END CASE;

  INSERT INTO work_item (org_id, type_key, name, status, responsible_id, created_by, updated_by)
  VALUES (NEW.org_id, 'risk', NEW.title, v_wi_status, NEW.owner_id, NEW.created_by, NEW.updated_by)
  RETURNING id INTO v_work_item_id;

  NEW.work_item_id := v_work_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER risk_auto_create_work_item
  BEFORE INSERT ON "risk"
  FOR EACH ROW
  WHEN (NEW.work_item_id IS NULL)
  EXECUTE FUNCTION risk_auto_create_work_item();--> statement-breakpoint

-- ─── 4. TRIGGER: sync work_item on risk UPDATE (title/status) ──

CREATE OR REPLACE FUNCTION risk_sync_work_item()
RETURNS TRIGGER AS $$
DECLARE
  v_wi_status work_item_status_generic;
BEGIN
  IF NEW.work_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only sync if title or status actually changed
  IF OLD.title IS DISTINCT FROM NEW.title OR OLD.status IS DISTINCT FROM NEW.status THEN
    -- Map risk status to work_item status
    CASE NEW.status
      WHEN 'identified' THEN v_wi_status := 'draft';
      WHEN 'assessed'   THEN v_wi_status := 'in_evaluation';
      WHEN 'treated'    THEN v_wi_status := 'in_treatment';
      WHEN 'accepted'   THEN v_wi_status := 'management_approved';
      WHEN 'closed'     THEN v_wi_status := 'completed';
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

CREATE TRIGGER risk_sync_work_item
  AFTER UPDATE ON "risk"
  FOR EACH ROW EXECUTE FUNCTION risk_sync_work_item();--> statement-breakpoint

-- ─── 5. set_updated_at TRIGGERS for ERM tables ──────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "risk"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "risk_treatment"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "kri"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "risk_appetite"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ─── 6. ROW-LEVEL SECURITY for ALL new tables (ADR-001) ─────

ALTER TABLE "risk" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "risk_appetite" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "risk_treatment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kri" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kri_measurement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "simulation_result" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "risk_framework_mapping" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "process_risk" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "process_step_risk" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "risk_asset" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "risk_control" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- org_isolation policies
CREATE POLICY org_isolation ON "risk"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "risk_appetite"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "risk_treatment"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "kri"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "kri_measurement"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "simulation_result"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "risk_framework_mapping"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "process_risk"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "process_step_risk"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "risk_asset"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "risk_control"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

-- reporting_bypass policies (for cross-org reporting)
CREATE POLICY reporting_bypass ON "risk"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "risk_appetite"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "risk_treatment"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "kri"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "kri_measurement"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "simulation_result"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "risk_framework_mapping"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "process_risk"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "process_step_risk"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "risk_asset"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

CREATE POLICY reporting_bypass ON "risk_control"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
  );--> statement-breakpoint

-- ─── 7. AUDIT TRIGGERS for business tables (ADR-011) ────────
-- Applied to: risk, risk_treatment, kri, risk_appetite
-- NOT applied to: kri_measurement, join tables

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "risk"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "risk_treatment"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "kri"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "risk_appetite"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();