-- Sprint 82: Integration Marketplace
-- Migration 1044: Create marketplace_review table

CREATE TABLE IF NOT EXISTS marketplace_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  listing_id UUID NOT NULL REFERENCES marketplace_listing(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(300),
  body TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  helpful_count INT NOT NULL DEFAULT 0,
  publisher_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mp_rev_org_idx ON marketplace_review(org_id);
CREATE INDEX mp_rev_listing_idx ON marketplace_review(listing_id);
CREATE UNIQUE INDEX mp_rev_user_listing ON marketplace_review(user_id, listing_id);

ALTER TABLE marketplace_review ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_review_org_isolation ON marketplace_review
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER marketplace_review_audit
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_review
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
