-- Sprint 23: Board KPIs — Risk Appetite + Assurance Confidence + Security Posture
-- Migration 329–338 (combined)

-- ──────────────────────────────────────────────────────────────
-- 329: Create risk_appetite_threshold
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "risk_appetite_threshold" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "risk_category" varchar(50) NOT NULL,
  "max_residual_score" integer NOT NULL CHECK ("max_residual_score" >= 1 AND "max_residual_score" <= 25),
  "max_residual_ale" numeric(15, 2),
  "escalation_role" varchar(50) DEFAULT 'admin',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" uuid,
  "deleted_at" timestamptz,
  "deleted_by" uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS "rat_org_cat_idx" ON "risk_appetite_threshold" ("org_id", "risk_category");
CREATE INDEX IF NOT EXISTS "rat_org_idx" ON "risk_appetite_threshold" ("org_id");

-- ──────────────────────────────────────────────────────────────
-- 330: Create assurance_score_snapshot
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "assurance_score_snapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "module" varchar(20) NOT NULL,
  "score" integer NOT NULL CHECK ("score" >= 0 AND "score" <= 100),
  "factors" jsonb NOT NULL,
  "recommendations" jsonb DEFAULT '[]',
  "snapshot_date" date NOT NULL,
  "computed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ass_org_mod_date_idx" ON "assurance_score_snapshot" ("org_id", "module", "snapshot_date");
CREATE INDEX IF NOT EXISTS "ass_org_idx" ON "assurance_score_snapshot" ("org_id");
CREATE INDEX IF NOT EXISTS "ass_org_date_idx" ON "assurance_score_snapshot" ("org_id", "snapshot_date");

-- ──────────────────────────────────────────────────────────────
-- 331: Create security_posture_snapshot
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "security_posture_snapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "overall_score" integer NOT NULL CHECK ("overall_score" >= 0 AND "overall_score" <= 100),
  "factors" jsonb NOT NULL,
  "domain_scores" jsonb DEFAULT '{}',
  "snapshot_date" date NOT NULL,
  "computed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "sps_org_date_idx" ON "security_posture_snapshot" ("org_id", "snapshot_date");
CREATE INDEX IF NOT EXISTS "sps_org_idx" ON "security_posture_snapshot" ("org_id");

-- ──────────────────────────────────────────────────────────────
-- 332: RLS policies for Sprint 23 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "risk_appetite_threshold" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assurance_score_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_posture_snapshot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "risk_appetite_threshold_org_isolation" ON "risk_appetite_threshold"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY "assurance_score_snapshot_org_isolation" ON "assurance_score_snapshot"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY "security_posture_snapshot_org_isolation" ON "security_posture_snapshot"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- 333: Audit triggers for Sprint 23 tables
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER "risk_appetite_threshold_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "risk_appetite_threshold"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Snapshots are append-only, no audit trigger needed for read-only snapshot tables
-- but we add INSERT-only triggers for compliance completeness

CREATE TRIGGER "assurance_score_snapshot_audit"
  AFTER INSERT ON "assurance_score_snapshot"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER "security_posture_snapshot_audit"
  AFTER INSERT ON "security_posture_snapshot"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 336: Additional aggregation indexes
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "risk_org_category_residual_idx"
  ON "risk" ("org_id", "risk_category", "risk_score_residual")
  WHERE "deleted_at" IS NULL;
