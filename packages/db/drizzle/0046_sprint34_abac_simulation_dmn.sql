-- Sprint 34: ABAC + Process Simulation + DMN Editor
-- Tables: abac_policy, abac_access_log, simulation_scenario, simulation_activity_param, simulation_result, dmn_decision
-- Migration range: 421-436

-- ──────────────────────────────────────────────────────────────
-- ABAC Policy
-- ──────────────────────────────────────────────────────────────
CREATE TABLE "abac_policy" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "entity_type" varchar(50) NOT NULL,
  "subject_condition" jsonb NOT NULL,
  "object_condition" jsonb NOT NULL,
  "access_level" varchar(10) NOT NULL,
  "priority" integer NOT NULL DEFAULT 100,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "abac_policy_org_idx" ON "abac_policy" ("org_id");
--> statement-breakpoint
CREATE INDEX "abac_policy_entity_idx" ON "abac_policy" ("org_id", "entity_type");
--> statement-breakpoint
CREATE INDEX "abac_policy_priority_idx" ON "abac_policy" ("org_id", "entity_type", "priority");

-- ──────────────────────────────────────────────────────────────
-- ABAC Access Log (append-only audit)
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "abac_access_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid,
  "access_level" varchar(10) NOT NULL,
  "decision" varchar(10) NOT NULL,
  "matched_policy_id" uuid,
  "evaluation_duration_ms" integer,
  "subject_attributes" jsonb,
  "object_attributes" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "abac_log_org_date_idx" ON "abac_access_log" ("org_id", "created_at");
--> statement-breakpoint
CREATE INDEX "abac_log_user_idx" ON "abac_access_log" ("user_id");
--> statement-breakpoint
CREATE INDEX "abac_log_decision_idx" ON "abac_access_log" ("org_id", "decision");

-- ──────────────────────────────────────────────────────────────
-- Simulation Scenario
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "simulation_scenario" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "process_id" uuid NOT NULL REFERENCES "process"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "case_count" integer NOT NULL DEFAULT 1000,
  "time_period_days" integer NOT NULL DEFAULT 30,
  "resource_config" jsonb DEFAULT '[]'::jsonb,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sim_scenario_org_idx" ON "simulation_scenario" ("org_id");
--> statement-breakpoint
CREATE INDEX "sim_scenario_process_idx" ON "simulation_scenario" ("process_id");

-- ──────────────────────────────────────────────────────────────
-- Simulation Activity Parameters
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "simulation_activity_param" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scenario_id" uuid NOT NULL REFERENCES "simulation_scenario"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL,
  "activity_id" varchar(200) NOT NULL,
  "activity_name" varchar(500),
  "duration_min" numeric(10,2) NOT NULL,
  "duration_most_likely" numeric(10,2) NOT NULL,
  "duration_max" numeric(10,2) NOT NULL,
  "cost_per_execution" numeric(15,2) DEFAULT '0',
  "resource_id" varchar(200),
  "gateway_probabilities" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sim_param_scenario_idx" ON "simulation_activity_param" ("scenario_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "sim_param_unique_idx" ON "simulation_activity_param" ("scenario_id", "activity_id");

-- ──────────────────────────────────────────────────────────────
-- BPM Simulation Result (Sprint 34)
-- ──────────────────────────────────────────────────────────────
-- Original migration created `simulation_result`, but that name was
-- already taken by 0006 (risk Monte-Carlo result, different schema).
-- The BPM simulation outputs moved into `process_simulation_result`
-- (added in 0099) — keep the name reserved here for readability.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bpm_simulation_result" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scenario_id" uuid NOT NULL REFERENCES "simulation_scenario"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL,
  "case_count" integer NOT NULL,
  "avg_cycle_time" numeric(15,4),
  "p50_cycle_time" numeric(15,4),
  "p95_cycle_time" numeric(15,4),
  "avg_cost" numeric(15,2),
  "total_cost" numeric(15,2),
  "bottleneck_activities" jsonb DEFAULT '[]'::jsonb,
  "cost_breakdown" jsonb DEFAULT '{}'::jsonb,
  "resource_utilization" jsonb DEFAULT '{}'::jsonb,
  "histogram" jsonb DEFAULT '[]'::jsonb,
  "raw_results" jsonb,
  "executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bpm_sim_result_scenario_idx" ON "bpm_simulation_result" ("scenario_id");

-- ──────────────────────────────────────────────────────────────
-- DMN Decision
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "dmn_decision" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "dmn_xml" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "linked_process_step_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "input_schema" jsonb DEFAULT '[]'::jsonb,
  "output_schema" jsonb DEFAULT '[]'::jsonb,
  "hit_policy" varchar(20) DEFAULT 'UNIQUE',
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dmn_decision_org_idx" ON "dmn_decision" ("org_id");
--> statement-breakpoint
CREATE INDEX "dmn_decision_status_idx" ON "dmn_decision" ("org_id", "status");
--> statement-breakpoint
CREATE INDEX "dmn_decision_step_idx" ON "dmn_decision" ("linked_process_step_id");

-- ──────────────────────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "abac_policy" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "abac_policy_org_isolation" ON "abac_policy" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "abac_access_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "abac_access_log_org_isolation" ON "abac_access_log" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "simulation_scenario" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sim_scenario_org_isolation" ON "simulation_scenario" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "simulation_activity_param" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sim_activity_param_org_isolation" ON "simulation_activity_param" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "simulation_result" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sim_result_org_isolation" ON "simulation_result" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "dmn_decision" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "dmn_decision_org_isolation" ON "dmn_decision" USING (org_id::text = current_setting('app.current_org_id', true));

-- ──────────────────────────────────────────────────────────────
-- Audit Triggers
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TRIGGER "abac_policy_audit" AFTER INSERT OR UPDATE OR DELETE ON "abac_policy" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "simulation_scenario_audit" AFTER INSERT OR UPDATE OR DELETE ON "simulation_scenario" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "simulation_result_audit" AFTER INSERT OR UPDATE OR DELETE ON "simulation_result" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "dmn_decision_audit" AFTER INSERT OR UPDATE OR DELETE ON "dmn_decision" FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- Seed: Default ABAC policies (examples)
-- ──────────────────────────────────────────────────────────────
-- Seed data is inserted at application level via seed-all.ts
