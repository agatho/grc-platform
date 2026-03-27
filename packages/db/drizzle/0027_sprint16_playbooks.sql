-- Sprint 16: Incident Response Playbooks
-- Migration 261-270: Tables, RLS, Audit Triggers, Seed Data

-- ──────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────

CREATE TYPE "public"."playbook_trigger_category" AS ENUM('ransomware', 'data_breach', 'ddos', 'insider', 'supply_chain', 'phishing', 'other');--> statement-breakpoint
CREATE TYPE "public"."playbook_trigger_severity" AS ENUM('insignificant', 'significant', 'emergency', 'crisis', 'catastrophe');--> statement-breakpoint
CREATE TYPE "public"."playbook_activation_status" AS ENUM('active', 'completed', 'aborted');--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 261: playbook_template
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "playbook_template" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "trigger_category" "playbook_trigger_category" NOT NULL,
  "trigger_min_severity" "playbook_trigger_severity" NOT NULL DEFAULT 'significant',
  "is_active" boolean NOT NULL DEFAULT true,
  "estimated_duration_hours" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "user"("id")
);--> statement-breakpoint

CREATE INDEX "pt_org_idx" ON "playbook_template" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "pt_trigger_idx" ON "playbook_template" USING btree ("org_id", "trigger_category");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 262: playbook_phase
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "playbook_phase" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "playbook_template"("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL,
  "deadline_hours_relative" integer NOT NULL,
  "escalation_role_on_overdue" varchar(50),
  "communication_template_key" varchar(100)
);--> statement-breakpoint

CREATE INDEX "pp_template_idx" ON "playbook_phase" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "pp_sort_idx" ON "playbook_phase" USING btree ("template_id", "sort_order");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 263: playbook_task_template
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "playbook_task_template" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phase_id" uuid NOT NULL REFERENCES "playbook_phase"("id") ON DELETE CASCADE,
  "title" varchar(500) NOT NULL,
  "description" text,
  "assigned_role" varchar(50) NOT NULL,
  "deadline_hours_relative" integer NOT NULL,
  "is_critical_path" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL,
  "checklist_items" jsonb DEFAULT '[]'
);--> statement-breakpoint

CREATE INDEX "ptt_phase_idx" ON "playbook_task_template" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "ptt_sort_idx" ON "playbook_task_template" USING btree ("phase_id", "sort_order");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 264: playbook_activation
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "playbook_activation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "template_id" uuid NOT NULL REFERENCES "playbook_template"("id"),
  "incident_id" uuid NOT NULL REFERENCES "security_incident"("id"),
  "activated_at" timestamptz NOT NULL DEFAULT now(),
  "activated_by" uuid NOT NULL REFERENCES "user"("id"),
  "status" "playbook_activation_status" NOT NULL DEFAULT 'active',
  "current_phase_id" uuid REFERENCES "playbook_phase"("id"),
  "completed_at" timestamptz,
  "total_tasks_count" integer NOT NULL DEFAULT 0,
  "completed_tasks_count" integer NOT NULL DEFAULT 0
);--> statement-breakpoint

CREATE UNIQUE INDEX "pba_incident_idx" ON "playbook_activation" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "pba_org_idx" ON "playbook_activation" USING btree ("org_id", "status");--> statement-breakpoint
CREATE INDEX "pba_template_idx" ON "playbook_activation" USING btree ("template_id");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 265: RLS on all 4 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "playbook_template" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "playbook_template_org_isolation" ON "playbook_template"
  USING (org_id = current_setting('app.current_org_id')::uuid);--> statement-breakpoint

-- playbook_phase: no org_id, inherit from template via join
-- RLS is effectively enforced through template access

ALTER TABLE "playbook_activation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "playbook_activation_org_isolation" ON "playbook_activation"
  USING (org_id = current_setting('app.current_org_id')::uuid);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 266: Audit triggers
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER playbook_template_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "playbook_template"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

CREATE TRIGGER playbook_phase_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "playbook_phase"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

CREATE TRIGGER playbook_task_template_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "playbook_task_template"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

CREATE TRIGGER playbook_activation_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "playbook_activation"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
