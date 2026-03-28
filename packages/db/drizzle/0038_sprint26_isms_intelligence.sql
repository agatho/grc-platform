-- Sprint 26: ISMS Intelligence — CVE Feed, AI SoA Gap, AI Maturity Roadmap
-- Migration 353–364 (combined)
-- Enhancement on ISMS (Sprint 5a/5b): CVE integration + AI analysis

-- ──────────────────────────────────────────────────────────────
-- 353: Create cve_feed_item — Platform-wide CVE feed entries
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cve_feed_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cve_id" varchar(20) NOT NULL,
  "source" varchar(20) NOT NULL,
  "title" varchar(1000) NOT NULL,
  "description" text,
  "cvss_score" numeric(3, 1) CHECK ("cvss_score" >= 0 AND "cvss_score" <= 10),
  "cvss_severity" varchar(10),
  "affected_cpes" jsonb DEFAULT '[]'::jsonb,
  "published_at" timestamptz NOT NULL,
  "modified_at" timestamptz,
  "references" jsonb DEFAULT '[]'::jsonb,
  "fetched_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "cfi_cve_idx" ON "cve_feed_item" ("cve_id");
CREATE INDEX IF NOT EXISTS "cfi_severity_idx" ON "cve_feed_item" ("cvss_severity");
CREATE INDEX IF NOT EXISTS "cfi_published_idx" ON "cve_feed_item" ("published_at");

-- ──────────────────────────────────────────────────────────────
-- 354: Create asset_cpe — CPE identifiers per asset per org
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "asset_cpe" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "asset_id" uuid NOT NULL REFERENCES "asset"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "cpe_uri" varchar(500) NOT NULL,
  "vendor" varchar(200),
  "product" varchar(200),
  "version" varchar(100),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "user"("id")
);

CREATE INDEX IF NOT EXISTS "acpe_org_idx" ON "asset_cpe" ("org_id");
CREATE INDEX IF NOT EXISTS "acpe_asset_idx" ON "asset_cpe" ("asset_id");
CREATE INDEX IF NOT EXISTS "acpe_vendor_product_idx" ON "asset_cpe" ("vendor", "product");

-- ──────────────────────────────────────────────────────────────
-- 355: Create cve_asset_match — CVE matched to org asset
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cve_asset_match" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cve_id" uuid NOT NULL REFERENCES "cve_feed_item"("id"),
  "asset_id" uuid NOT NULL REFERENCES "asset"("id"),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "matched_cpe" varchar(500),
  "status" varchar(20) NOT NULL DEFAULT 'new',
  "acknowledged_by" uuid REFERENCES "user"("id"),
  "acknowledged_at" timestamptz,
  "linked_vulnerability_id" uuid,
  "matched_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cam_status_check" CHECK ("status" IN ('new', 'acknowledged', 'mitigated', 'not_applicable'))
);

CREATE INDEX IF NOT EXISTS "cam_org_idx" ON "cve_asset_match" ("org_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "cam_unique_idx" ON "cve_asset_match" ("cve_id", "asset_id");

-- ──────────────────────────────────────────────────────────────
-- 356: Create soa_ai_suggestion — AI gap analysis results
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "soa_ai_suggestion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "analysis_run_id" uuid NOT NULL,
  "framework" varchar(100) NOT NULL,
  "framework_control_ref" varchar(100) NOT NULL,
  "framework_control_title" varchar(500),
  "suggested_control_id" uuid REFERENCES "control"("id"),
  "confidence" integer NOT NULL CHECK ("confidence" >= 0 AND "confidence" <= 100),
  "gap_type" varchar(30) NOT NULL CHECK ("gap_type" IN ('not_covered', 'partial', 'full')),
  "reasoning" text,
  "priority" varchar(20) NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('critical', 'high', 'medium', 'low')),
  "status" varchar(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'rejected')),
  "reviewed_by" uuid REFERENCES "user"("id"),
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sas_org_idx" ON "soa_ai_suggestion" ("org_id");
CREATE INDEX IF NOT EXISTS "sas_run_idx" ON "soa_ai_suggestion" ("analysis_run_id");
CREATE INDEX IF NOT EXISTS "sas_status_idx" ON "soa_ai_suggestion" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "sas_framework_idx" ON "soa_ai_suggestion" ("org_id", "framework");

-- ──────────────────────────────────────────────────────────────
-- 357: Create maturity_roadmap_action — AI roadmap actions
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "maturity_roadmap_action" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "roadmap_run_id" uuid NOT NULL,
  "domain" varchar(200) NOT NULL,
  "current_level" integer NOT NULL CHECK ("current_level" >= 1 AND "current_level" <= 5),
  "target_level" integer NOT NULL CHECK ("target_level" >= 1 AND "target_level" <= 5),
  "title" varchar(500) NOT NULL,
  "description" text,
  "effort" varchar(10) NOT NULL DEFAULT 'M' CHECK ("effort" IN ('S', 'M', 'L')),
  "effort_fte_months" numeric(5, 1),
  "priority" integer NOT NULL DEFAULT 50 CHECK ("priority" >= 1 AND "priority" <= 100),
  "quarter" varchar(10),
  "is_quick_win" boolean NOT NULL DEFAULT false,
  "dependencies" jsonb DEFAULT '[]'::jsonb,
  "status" varchar(20) NOT NULL DEFAULT 'proposed' CHECK ("status" IN ('proposed', 'in_progress', 'completed', 'dismissed')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mra_org_idx" ON "maturity_roadmap_action" ("org_id");
CREATE INDEX IF NOT EXISTS "mra_run_idx" ON "maturity_roadmap_action" ("roadmap_run_id");
CREATE INDEX IF NOT EXISTS "mra_priority_idx" ON "maturity_roadmap_action" ("org_id", "priority");
CREATE INDEX IF NOT EXISTS "mra_quickwin_idx" ON "maturity_roadmap_action" ("org_id", "is_quick_win");

-- ──────────────────────────────────────────────────────────────
-- 358: RLS policies for Sprint 26 tables
-- ──────────────────────────────────────────────────────────────

-- cve_feed_item: platform-wide (no org_id), no RLS needed
-- (all authenticated users can read CVE feed items)

-- asset_cpe: org-scoped
ALTER TABLE "asset_cpe" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_cpe_org_isolation" ON "asset_cpe";
CREATE POLICY "asset_cpe_org_isolation" ON "asset_cpe"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS "asset_cpe_insert" ON "asset_cpe";
CREATE POLICY "asset_cpe_insert" ON "asset_cpe"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);

-- cve_asset_match: org-scoped
ALTER TABLE "cve_asset_match" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cve_asset_match_org_isolation" ON "cve_asset_match";
CREATE POLICY "cve_asset_match_org_isolation" ON "cve_asset_match"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS "cve_asset_match_insert" ON "cve_asset_match";
CREATE POLICY "cve_asset_match_insert" ON "cve_asset_match"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);

-- soa_ai_suggestion: org-scoped
ALTER TABLE "soa_ai_suggestion" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "soa_ai_suggestion_org_isolation" ON "soa_ai_suggestion";
CREATE POLICY "soa_ai_suggestion_org_isolation" ON "soa_ai_suggestion"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS "soa_ai_suggestion_insert" ON "soa_ai_suggestion";
CREATE POLICY "soa_ai_suggestion_insert" ON "soa_ai_suggestion"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);

-- maturity_roadmap_action: org-scoped
ALTER TABLE "maturity_roadmap_action" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maturity_roadmap_action_org_isolation" ON "maturity_roadmap_action";
CREATE POLICY "maturity_roadmap_action_org_isolation" ON "maturity_roadmap_action"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS "maturity_roadmap_action_insert" ON "maturity_roadmap_action";
CREATE POLICY "maturity_roadmap_action_insert" ON "maturity_roadmap_action"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- 359: Audit triggers for Sprint 26 tables
-- ──────────────────────────────────────────────────────────────

-- Register audit triggers (assumes audit_trigger() function exists from Sprint 1)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_cve_asset_match') THEN
    CREATE TRIGGER audit_cve_asset_match
      AFTER INSERT OR UPDATE OR DELETE ON "cve_asset_match"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_asset_cpe') THEN
    CREATE TRIGGER audit_asset_cpe
      AFTER INSERT OR UPDATE OR DELETE ON "asset_cpe"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_soa_ai_suggestion') THEN
    CREATE TRIGGER audit_soa_ai_suggestion
      AFTER INSERT OR UPDATE OR DELETE ON "soa_ai_suggestion"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_maturity_roadmap_action') THEN
    CREATE TRIGGER audit_maturity_roadmap_action
      AFTER INSERT OR UPDATE OR DELETE ON "maturity_roadmap_action"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 360: Additional indexes for CPE matching performance
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "acpe_cpe_trgm_idx" ON "asset_cpe" USING btree ("cpe_uri");
CREATE INDEX IF NOT EXISTS "cfi_affected_cpes_gin_idx" ON "cve_feed_item" USING gin ("affected_cpes");

-- ──────────────────────────────────────────────────────────────
-- 361: Updated_at triggers for mutable Sprint 26 tables
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sprint26_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_cve_asset_match') THEN
    CREATE TRIGGER set_updated_at_cve_asset_match
      BEFORE UPDATE ON "cve_asset_match"
      FOR EACH ROW EXECUTE FUNCTION sprint26_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_soa_ai_suggestion') THEN
    CREATE TRIGGER set_updated_at_soa_ai_suggestion
      BEFORE UPDATE ON "soa_ai_suggestion"
      FOR EACH ROW EXECUTE FUNCTION sprint26_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_maturity_roadmap_action') THEN
    CREATE TRIGGER set_updated_at_maturity_roadmap_action
      BEFORE UPDATE ON "maturity_roadmap_action"
      FOR EACH ROW EXECUTE FUNCTION sprint26_updated_at();
  END IF;
END $$;
