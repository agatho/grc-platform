-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-01] In-place repariert.
-- Diese Migration ist gegen eine leere Datenbank nie erfolgreich gelaufen
-- (Audit-Finding S09-01) und gilt nach ADR-014 als nicht ausgeliefert; die
-- Änderung an der bestehenden Datei ist daher zulässig.
-- Änderung: Index idx_control_org_effectiveness zeigte auf die nicht existierende Spalte control.effectiveness_rating (42703) und brach die Datei ab.
-- Sprint 27: Compliance Culture Index + Multi-Tenancy Performance Optimization
-- Migration 365–372 (combined)
-- CCI snapshot table, configuration, RLS, audit triggers, composite indexes

-- ──────────────────────────────────────────────────────────────
-- 365: Create compliance_culture_snapshot
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "compliance_culture_snapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "org_entity_id" uuid,
  "period" varchar(7) NOT NULL,
  "overall_score" numeric(5, 2) NOT NULL CHECK ("overall_score" >= 0 AND "overall_score" <= 100),
  "factor_scores" jsonb NOT NULL,
  "factor_weights" jsonb NOT NULL,
  "raw_metrics" jsonb NOT NULL,
  "trend" varchar(10) CHECK ("trend" IN ('up', 'down', 'stable')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- [ARCTOS-FULL-2026-08-31 / S09-01] Die Indexnamen ccs_* kollidierten
-- schemaweit mit 0166_create_cloud_compliance_snapshot.sql. Solange 0039
-- scheiterte, fiel das nicht auf; 0166 ist in allen Umgebungen gelaufen und
-- behaelt daher seine Namen. Umbenannt auf cculture_*.
CREATE UNIQUE INDEX IF NOT EXISTS "cculture_org_period_entity_idx"
  ON "compliance_culture_snapshot" ("org_id", "org_entity_id", "period");
CREATE INDEX IF NOT EXISTS "cculture_org_idx"
  ON "compliance_culture_snapshot" ("org_id");
CREATE INDEX IF NOT EXISTS "cculture_period_idx"
  ON "compliance_culture_snapshot" ("org_id", "period");

-- ──────────────────────────────────────────────────────────────
-- 366: Create cci_configuration
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cci_configuration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "factor_weights" jsonb NOT NULL DEFAULT '{"task_compliance":0.20,"policy_ack_rate":0.15,"training_completion":0.15,"incident_response_time":0.20,"audit_finding_closure":0.15,"self_assessment_participation":0.15}'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS "cci_config_org_idx"
  ON "cci_configuration" ("org_id");

-- ──────────────────────────────────────────────────────────────
-- 367: RLS policies for Sprint 27 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "compliance_culture_snapshot" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccs_org_isolation" ON "compliance_culture_snapshot";
CREATE POLICY "ccs_org_isolation" ON "compliance_culture_snapshot"
  USING ("org_id"::text = current_setting('app.current_org_id', true));

ALTER TABLE "cci_configuration" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cci_config_org_isolation" ON "cci_configuration";
CREATE POLICY "cci_config_org_isolation" ON "cci_configuration"
  USING ("org_id"::text = current_setting('app.current_org_id', true));

-- ──────────────────────────────────────────────────────────────
-- 368: Audit triggers for Sprint 27 tables
-- ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger_func') THEN
    DROP TRIGGER IF EXISTS "compliance_culture_snapshot_audit" ON "compliance_culture_snapshot";
    CREATE TRIGGER "compliance_culture_snapshot_audit"
      AFTER INSERT OR UPDATE OR DELETE ON "compliance_culture_snapshot"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

    DROP TRIGGER IF EXISTS "cci_configuration_audit" ON "cci_configuration";
    CREATE TRIGGER "cci_configuration_audit"
      AFTER INSERT OR UPDATE OR DELETE ON "cci_configuration"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 369: Composite indexes for performance optimization
-- Uses CONCURRENTLY to avoid table locks in production
-- ──────────────────────────────────────────────────────────────

-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- These must be executed as individual statements outside transaction block.
-- Drizzle runs each migration file as a transaction, so we use IF NOT EXISTS
-- and standard CREATE INDEX instead. For production, run these manually with CONCURRENTLY.

CREATE INDEX IF NOT EXISTS "idx_work_item_org_due"
  ON "work_item" ("org_id", "due_date")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_finding_org_status_perf"
  ON "finding" ("org_id", "status", "remediation_due_date")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_risk_org_category"
  ON "risk" ("org_id", "risk_category")
  WHERE "deleted_at" IS NULL;

-- [ARCTOS-FULL-2026-08-31 / S09-01] `control` hat keine Spalte
-- `effectiveness_rating` — Wirksamkeit wird ueber control_test/test_result
-- modelliert (src/schema/control.ts). Der Index war konzeptionell tot und
-- brach die gesamte Datei ab; er zeigt jetzt auf die reale Modellierung.
CREATE INDEX IF NOT EXISTS "idx_control_test_org_result"
  ON "control_test" ("org_id", "status");

CREATE INDEX IF NOT EXISTS "idx_incident_org_created"
  ON "security_incident" ("org_id", "created_at")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_work_item_org_completed"
  ON "work_item" ("org_id", "completed_at")
  WHERE "deleted_at" IS NULL AND "completed_at" IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 370: Seed default CCI weights for existing orgs
-- ──────────────────────────────────────────────────────────────

INSERT INTO "cci_configuration" ("org_id", "factor_weights")
SELECT id, '{"task_compliance":0.20,"policy_ack_rate":0.15,"training_completion":0.15,"incident_response_time":0.20,"audit_finding_closure":0.15,"self_assessment_participation":0.15}'::jsonb
FROM "organization"
WHERE "deleted_at" IS NULL
ON CONFLICT DO NOTHING;
