-- Sprint 82: Integration Marketplace
-- Migration 1042: Create marketplace_listing table

DO $$ BEGIN
  CREATE TYPE marketplace_listing_status AS ENUM ('draft', 'pending_review', 'published', 'suspended', 'deprecated', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS marketplace_listing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  publisher_id UUID NOT NULL REFERENCES marketplace_publisher(id),
  category_id UUID NOT NULL REFERENCES marketplace_category(id),
  name VARCHAR(500) NOT NULL,
  slug VARCHAR(300) NOT NULL,
  summary VARCHAR(1000) NOT NULL,
  description TEXT,
  icon_url VARCHAR(2000),
  screenshot_urls JSONB NOT NULL DEFAULT '[]',
  tags JSONB NOT NULL DEFAULT '[]',
  status marketplace_listing_status NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  price_type VARCHAR(20) NOT NULL DEFAULT 'free',
  price_amount NUMERIC(10,2),
  price_currency VARCHAR(3) DEFAULT 'EUR',
  install_count INT NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  review_count INT NOT NULL DEFAULT 0,
  minimum_version VARCHAR(50),
  support_url VARCHAR(2000),
  documentation_url VARCHAR(2000),
  created_by UUID REFERENCES "user"(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mp_list_org_idx ON marketplace_listing(org_id);
CREATE INDEX mp_list_pub_idx ON marketplace_listing(publisher_id);
CREATE INDEX mp_list_cat_idx ON marketplace_listing(category_id);
CREATE INDEX mp_list_status_idx ON marketplace_listing(status);
CREATE INDEX mp_list_featured_idx ON marketplace_listing(is_featured, status);
CREATE UNIQUE INDEX mp_list_slug_unique ON marketplace_listing(slug);

ALTER TABLE marketplace_listing ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_listing_org_isolation ON marketplace_listing
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER marketplace_listing_audit
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_listing
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
