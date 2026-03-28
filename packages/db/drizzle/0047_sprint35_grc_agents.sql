-- Sprint 35: GRC Monitoring Agents (MCP-based)
-- Tables: agent_registration, agent_execution_log, agent_recommendation
-- Migration range: 437-448

-- ──────────────────────────────────────────────────────────────
-- Agent Registration
-- ──────────────────────────────────────────────────────────────
CREATE TABLE "agent_registration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "agent_type" varchar(50) NOT NULL,
  "name" varchar(500) NOT NULL,
  "description" text,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT false,
  "last_run_at" timestamp with time zone,
  "next_run_at" timestamp with time zone,
  "status" varchar(20) NOT NULL DEFAULT 'idle',
  "error_message" text,
  "total_run_count" integer NOT NULL DEFAULT 0,
  "total_recommendations" integer NOT NULL DEFAULT 0,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ar_org_idx" ON "agent_registration" ("org_id");
--> statement-breakpoint
CREATE INDEX "ar_type_idx" ON "agent_registration" ("org_id", "agent_type");
--> statement-breakpoint
CREATE INDEX "ar_active_idx" ON "agent_registration" ("org_id", "is_active");

-- ──────────────────────────────────────────────────────────────
-- Agent Execution Log
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "agent_execution_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agent_registration"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL,
  "phase" varchar(20) NOT NULL,
  "observed_data" jsonb,
  "evaluation" jsonb,
  "recommendations" jsonb DEFAULT '[]'::jsonb,
  "actions_created" jsonb DEFAULT '[]'::jsonb,
  "items_found" integer DEFAULT 0,
  "recommendations_generated" integer DEFAULT 0,
  "duration_ms" integer,
  "ai_tokens_used" integer DEFAULT 0,
  "error_message" text,
  "executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ael_agent_idx" ON "agent_execution_log" ("agent_id");
--> statement-breakpoint
CREATE INDEX "ael_date_idx" ON "agent_execution_log" ("org_id", "executed_at");
--> statement-breakpoint
CREATE INDEX "ael_org_idx" ON "agent_execution_log" ("org_id");

-- ──────────────────────────────────────────────────────────────
-- Agent Recommendation
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "agent_recommendation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agent_registration"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL,
  "severity" varchar(10) NOT NULL,
  "title" varchar(500) NOT NULL,
  "reasoning" text NOT NULL,
  "suggested_action" varchar(50),
  "entity_type" varchar(50),
  "entity_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "dismiss_reason" text,
  "accepted_by" uuid REFERENCES "user"("id"),
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "arec_org_status_idx" ON "agent_recommendation" ("org_id", "status");
--> statement-breakpoint
CREATE INDEX "arec_agent_idx" ON "agent_recommendation" ("agent_id");
--> statement-breakpoint
CREATE INDEX "arec_severity_idx" ON "agent_recommendation" ("org_id", "severity");

-- ──────────────────────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "agent_registration" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agent_reg_org_isolation" ON "agent_registration" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "agent_execution_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agent_log_org_isolation" ON "agent_execution_log" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "agent_recommendation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agent_rec_org_isolation" ON "agent_recommendation" USING (org_id::text = current_setting('app.current_org_id', true));

-- ──────────────────────────────────────────────────────────────
-- Audit Triggers
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TRIGGER "agent_registration_audit" AFTER INSERT OR UPDATE OR DELETE ON "agent_registration" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "agent_recommendation_audit" AFTER INSERT OR UPDATE OR DELETE ON "agent_recommendation" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
