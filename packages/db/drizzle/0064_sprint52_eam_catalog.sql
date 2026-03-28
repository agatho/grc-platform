-- Sprint 52: EAM UX & Unified Catalog
-- Migration 801-815: Keywords, homepage layout, GIN indices

-- ──────────────────────────────────────────────────────────────
-- ALTER tables: Add keywords array + GIN index
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "architecture_element" ADD COLUMN IF NOT EXISTS "keywords" TEXT[] DEFAULT '{}';
ALTER TABLE "business_capability" ADD COLUMN IF NOT EXISTS "keywords" TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "ae_keywords_gin" ON "architecture_element" USING GIN ("keywords");
CREATE INDEX IF NOT EXISTS "bc_keywords_gin" ON "business_capability" USING GIN ("keywords");

-- ──────────────────────────────────────────────────────────────
-- EAM Keyword registry
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_keyword" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "name" VARCHAR(100) NOT NULL,
  "parent_id" UUID REFERENCES "eam_keyword"(id),
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ek_unique_idx" ON "eam_keyword" ("org_id", "name");
CREATE INDEX IF NOT EXISTS "ek_org_idx" ON "eam_keyword" ("org_id");
CREATE INDEX IF NOT EXISTS "ek_parent_idx" ON "eam_keyword" ("parent_id");

-- ──────────────────────────────────────────────────────────────
-- EAM Homepage Layout
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_homepage_layout" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "user"(id),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "widget_config" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ehl_unique_idx" ON "eam_homepage_layout" ("user_id", "org_id");
CREATE INDEX IF NOT EXISTS "ehl_org_idx" ON "eam_homepage_layout" ("org_id");
CREATE INDEX IF NOT EXISTS "ehl_user_idx" ON "eam_homepage_layout" ("user_id");

-- ──────────────────────────────────────────────────────────────
-- Keyword usage count trigger
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_keyword_usage_count() RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate usage count for all keywords in the org
  UPDATE eam_keyword ek SET usage_count = (
    SELECT COUNT(*) FROM (
      SELECT unnest(keywords) AS kw FROM architecture_element WHERE org_id = ek.org_id
      UNION ALL
      SELECT unnest(keywords) AS kw FROM business_capability WHERE org_id = ek.org_id
    ) sub WHERE sub.kw = ek.name
  )
  WHERE ek.org_id = COALESCE(NEW.org_id, OLD.org_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ae_keyword_usage ON "architecture_element";
CREATE TRIGGER trg_ae_keyword_usage
  AFTER INSERT OR UPDATE OF keywords OR DELETE ON "architecture_element"
  FOR EACH ROW EXECUTE FUNCTION update_keyword_usage_count();

DROP TRIGGER IF EXISTS trg_bc_keyword_usage ON "business_capability";
CREATE TRIGGER trg_bc_keyword_usage
  AFTER INSERT OR UPDATE OF keywords OR DELETE ON "business_capability"
  FOR EACH ROW EXECUTE FUNCTION update_keyword_usage_count();

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "eam_keyword" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_homepage_layout" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ek_org_isolation" ON "eam_keyword" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "ehl_org_isolation" ON "eam_homepage_layout" USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- Audit triggers
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER audit_eam_keyword AFTER INSERT OR UPDATE OR DELETE ON "eam_keyword" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_homepage_layout AFTER INSERT OR UPDATE OR DELETE ON "eam_homepage_layout" FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- Unified catalog performance indices
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "ae_type_name_idx" ON "architecture_element" ("org_id", "type", "name");
CREATE INDEX IF NOT EXISTS "bc_name_idx" ON "business_capability" ("org_id", "name");
CREATE INDEX IF NOT EXISTS "edo_name_idx" ON "eam_data_object" ("org_id", "name");
