-- Sprint 82: Integration Marketplace
-- Migration 1041: Create marketplace_category table

DO $$ BEGIN
  CREATE TYPE marketplace_category_type AS ENUM ('connector', 'framework', 'template', 'dashboard', 'ai_prompt', 'industry_pack', 'workflow', 'report');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS marketplace_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  description TEXT,
  category_type marketplace_category_type NOT NULL,
  parent_id UUID,
  icon_name VARCHAR(100),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mp_cat_slug_unique ON marketplace_category(slug);
CREATE INDEX mp_cat_type_idx ON marketplace_category(category_type);

CREATE TRIGGER marketplace_category_audit
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_category
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
