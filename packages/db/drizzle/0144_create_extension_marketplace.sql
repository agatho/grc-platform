-- Sprint 58: Extension Marketplace
-- Migration 906: Create extension_marketplace table

CREATE TABLE IF NOT EXISTS extension_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugin(id) UNIQUE,
  title VARCHAR(255) NOT NULL,
  short_description VARCHAR(500),
  long_description TEXT,
  screenshots JSONB DEFAULT '[]',
  pricing_model VARCHAR(30) NOT NULL DEFAULT 'free',
  price_monthly INT,
  price_yearly INT,
  download_count INT NOT NULL DEFAULT 0,
  rating INT,
  review_count INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ext_marketplace_featured_idx ON extension_marketplace(is_featured);
CREATE INDEX ext_marketplace_pricing_idx ON extension_marketplace(pricing_model);
CREATE INDEX ext_marketplace_rating_idx ON extension_marketplace(rating);
