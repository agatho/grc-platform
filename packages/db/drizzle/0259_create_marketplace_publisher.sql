-- Sprint 82: Integration Marketplace
-- Migration 1040: Create marketplace_publisher table

CREATE TABLE IF NOT EXISTS marketplace_publisher (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(300) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  description TEXT,
  website_url VARCHAR(2000),
  logo_url VARCHAR(2000),
  contact_email VARCHAR(500),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  revenue_share_pct NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  total_earnings NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mp_pub_org_idx ON marketplace_publisher(org_id);
CREATE UNIQUE INDEX mp_pub_slug_unique ON marketplace_publisher(slug);

ALTER TABLE marketplace_publisher ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_publisher_org_isolation ON marketplace_publisher
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER marketplace_publisher_audit
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_publisher
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
