-- Sprint 15: Policy Acknowledgment Portal
-- Migration 253-260: Tables, RLS, Audit triggers, Seeds, Indices

-- ──────────────────────────────────────────────────────────────
-- 253: Create policy_distribution
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "policy_distribution" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "document_id" uuid NOT NULL REFERENCES "document"("id"),
  "document_version" integer NOT NULL,
  "title" varchar(500) NOT NULL,
  "target_scope" jsonb NOT NULL DEFAULT '{}',
  "deadline" timestamptz NOT NULL,
  "is_mandatory" boolean NOT NULL DEFAULT true,
  "requires_quiz" boolean NOT NULL DEFAULT false,
  "quiz_pass_threshold" integer DEFAULT 80,
  "quiz_questions" jsonb DEFAULT '[]',
  "reminder_days_before" jsonb DEFAULT '[7, 3, 1]',
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "distributed_at" timestamptz,
  "distributed_by" uuid REFERENCES "user"("id"),
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pd_org_idx" ON "policy_distribution"("org_id");
CREATE INDEX IF NOT EXISTS "pd_doc_idx" ON "policy_distribution"("document_id");
CREATE INDEX IF NOT EXISTS "pd_status_idx" ON "policy_distribution"("org_id", "status");
CREATE INDEX IF NOT EXISTS "pd_deadline_idx" ON "policy_distribution"("org_id", "deadline");

-- ──────────────────────────────────────────────────────────────
-- 254: Create policy_acknowledgment
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "policy_acknowledgment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "distribution_id" uuid NOT NULL REFERENCES "policy_distribution"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "user"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "acknowledged_at" timestamptz,
  "signature_hash" varchar(128),
  "quiz_score" integer,
  "quiz_passed" boolean,
  "read_duration_seconds" integer,
  "ip_address" varchar(45),
  "user_agent" varchar(500),
  "reminders_sent" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "pa_dist_user_idx" ON "policy_acknowledgment"("distribution_id", "user_id");
CREATE INDEX IF NOT EXISTS "pa_user_idx" ON "policy_acknowledgment"("user_id", "status");
CREATE INDEX IF NOT EXISTS "pa_org_idx" ON "policy_acknowledgment"("org_id");
CREATE INDEX IF NOT EXISTS "pa_org_status_idx" ON "policy_acknowledgment"("org_id", "status");

-- ──────────────────────────────────────────────────────────────
-- 255: Create policy_quiz_response
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "policy_quiz_response" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "acknowledgment_id" uuid NOT NULL REFERENCES "policy_acknowledgment"("id") ON DELETE CASCADE,
  "question_index" integer NOT NULL,
  "selected_option_index" integer NOT NULL,
  "is_correct" boolean NOT NULL,
  "answered_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pqr_ack_idx" ON "policy_quiz_response"("acknowledgment_id");
CREATE INDEX IF NOT EXISTS "pqr_org_idx" ON "policy_quiz_response"("org_id");

-- ──────────────────────────────────────────────────────────────
-- 256: RLS on all 3 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "policy_distribution" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_distribution_org_isolation" ON "policy_distribution";
CREATE POLICY "policy_distribution_org_isolation" ON "policy_distribution"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE "policy_acknowledgment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_acknowledgment_org_isolation" ON "policy_acknowledgment";
CREATE POLICY "policy_acknowledgment_org_isolation" ON "policy_acknowledgment"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE "policy_quiz_response" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_quiz_response_org_isolation" ON "policy_quiz_response";
CREATE POLICY "policy_quiz_response_org_isolation" ON "policy_quiz_response"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- 257: Audit triggers
-- ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS "audit_policy_distribution" ON "policy_distribution";
CREATE TRIGGER "audit_policy_distribution"
  AFTER INSERT OR UPDATE OR DELETE ON "policy_distribution"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS "audit_policy_acknowledgment" ON "policy_acknowledgment";
CREATE TRIGGER "audit_policy_acknowledgment"
  AFTER INSERT OR UPDATE OR DELETE ON "policy_acknowledgment"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS "audit_policy_quiz_response" ON "policy_quiz_response";
CREATE TRIGGER "audit_policy_quiz_response"
  AFTER INSERT OR UPDATE OR DELETE ON "policy_quiz_response"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 258: Seed email templates for policy acknowledgment
-- ──────────────────────────────────────────────────────────────
-- Original design stored templates in `notification` (misusing a
-- per-user table for global templates, with `type = 'system'` which
-- isn't a valid notification_type enum value and user_id NULL which
-- violates the NOT NULL constraint). These seeds never applied
-- cleanly; the actual templates are rendered from @grc/email at
-- runtime. No-op until a dedicated `email_template` table is added.

-- ──────────────────────────────────────────────────────────────
-- 259: Composite indices for compliance aggregation
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "pa_compliance_agg_idx"
  ON "policy_acknowledgment"("distribution_id", "status");

CREATE INDEX IF NOT EXISTS "pd_active_deadline_idx"
  ON "policy_distribution"("org_id", "status", "deadline")
  WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS "pa_overdue_idx"
  ON "policy_acknowledgment"("org_id", "status", "distribution_id")
  WHERE "status" IN ('pending', 'overdue');
