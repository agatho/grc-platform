-- Sprint 48: EAM Dashboards & Extended Assessment
-- Migration 729-745: ALTER application_portfolio, business_capability, new tables, triggers

-- ──────────────────────────────────────────────────────────────
-- ALTER application_portfolio: Add assessment fields
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "application_portfolio" ADD COLUMN IF NOT EXISTS "functional_fit" VARCHAR(20);
ALTER TABLE "application_portfolio" ADD COLUMN IF NOT EXISTS "technical_fit" VARCHAR(20);
ALTER TABLE "application_portfolio" ADD COLUMN IF NOT EXISTS "six_r_strategy" VARCHAR(20);
ALTER TABLE "application_portfolio" ADD COLUMN IF NOT EXISTS "business_criticality" VARCHAR(30);
ALTER TABLE "application_portfolio" ADD COLUMN IF NOT EXISTS "last_assessed_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "application_portfolio" ADD COLUMN IF NOT EXISTS "assessed_by" UUID REFERENCES "user"(id);

-- ──────────────────────────────────────────────────────────────
-- ALTER business_capability: Add lifecycle fields
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "business_capability" ADD COLUMN IF NOT EXISTS "functional_coverage" VARCHAR(20);
ALTER TABLE "business_capability" ADD COLUMN IF NOT EXISTS "strategic_alignment" VARCHAR(20);
ALTER TABLE "business_capability" ADD COLUMN IF NOT EXISTS "lifecycle_status" VARCHAR(20);

-- ──────────────────────────────────────────────────────────────
-- Add 'provider' to architecture_type enum
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE architecture_type ADD VALUE IF NOT EXISTS 'provider';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ──────────────────────────────────────────────────────────────
-- Create application_assessment_history
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "application_assessment_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "application_portfolio_id" UUID NOT NULL REFERENCES "application_portfolio"(id) ON DELETE CASCADE,
  "dimension" VARCHAR(30) NOT NULL,
  "old_value" VARCHAR(50),
  "new_value" VARCHAR(50) NOT NULL,
  "changed_by" UUID REFERENCES "user"(id),
  "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "justification" TEXT
);

CREATE INDEX IF NOT EXISTS "aah_app_idx" ON "application_assessment_history" ("application_portfolio_id");
CREATE INDEX IF NOT EXISTS "aah_dim_idx" ON "application_assessment_history" ("application_portfolio_id", "dimension");
CREATE INDEX IF NOT EXISTS "aah_org_idx" ON "application_assessment_history" ("org_id");

-- ──────────────────────────────────────────────────────────────
-- Assessment history trigger
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION track_assessment_changes() RETURNS TRIGGER AS $$
DECLARE
  dims TEXT[] := ARRAY['functional_fit','technical_fit','six_r_strategy','time_classification','business_criticality','business_value','technical_condition'];
  dim TEXT;
BEGIN
  FOREACH dim IN ARRAY dims LOOP
    IF (row_to_json(NEW)->>dim) IS DISTINCT FROM (row_to_json(OLD)->>dim) THEN
      INSERT INTO application_assessment_history (org_id, application_portfolio_id, dimension, old_value, new_value, changed_by, changed_at)
      VALUES (NEW.org_id, NEW.id, dim, row_to_json(OLD)->>dim, row_to_json(NEW)->>dim, NEW.assessed_by, NOW());
    END IF;
  END LOOP;
  NEW.last_assessed_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assessment_changes ON application_portfolio;
CREATE TRIGGER trg_assessment_changes
  BEFORE UPDATE ON application_portfolio
  FOR EACH ROW
  EXECUTE FUNCTION track_assessment_changes();

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "application_assessment_history" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aah_org_isolation" ON "application_assessment_history";
CREATE POLICY "aah_org_isolation" ON "application_assessment_history"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- Audit trigger
-- ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS audit_application_assessment_history ON "application_assessment_history";
CREATE TRIGGER audit_application_assessment_history
  AFTER INSERT OR UPDATE OR DELETE ON "application_assessment_history"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- Performance indices for cost aggregation
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "ap_cost_cat_idx" ON "application_portfolio" ("org_id", "license_type");
CREATE INDEX IF NOT EXISTS "ap_annual_cost_idx" ON "application_portfolio" ("org_id", "annual_cost");
CREATE INDEX IF NOT EXISTS "ap_functional_fit_idx" ON "application_portfolio" ("org_id", "functional_fit");
CREATE INDEX IF NOT EXISTS "ap_technical_fit_idx" ON "application_portfolio" ("org_id", "technical_fit");
CREATE INDEX IF NOT EXISTS "ap_six_r_idx" ON "application_portfolio" ("org_id", "six_r_strategy");
CREATE INDEX IF NOT EXISTS "ap_criticality_idx" ON "application_portfolio" ("org_id", "business_criticality");
CREATE INDEX IF NOT EXISTS "ae_cost_provider_idx" ON "architecture_element" ("org_id", "layer") WHERE layer = 'technology';
CREATE INDEX IF NOT EXISTS "bc_lifecycle_status_idx" ON "business_capability" ("org_id", "lifecycle_status");
