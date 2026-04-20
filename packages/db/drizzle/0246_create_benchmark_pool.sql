-- Sprint 78: GRC Benchmarking und Maturity Model
-- Migration 1027: Create benchmark_pool table

DO $$ BEGIN
  CREATE TYPE benchmark_industry AS ENUM ('financial_services', 'healthcare', 'manufacturing', 'technology', 'energy', 'retail', 'public_sector', 'insurance', 'automotive', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS benchmark_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key maturity_module_key NOT NULL,
  industry benchmark_industry NOT NULL,
  org_size_range VARCHAR(50) NOT NULL,
  participant_count INT NOT NULL DEFAULT 0,
  avg_score NUMERIC(5,2),
  median_score NUMERIC(5,2),
  p25_score NUMERIC(5,2),
  p75_score NUMERIC(5,2),
  distribution JSONB NOT NULL DEFAULT '{}',
  period_label VARCHAR(50) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bp_module_idx ON benchmark_pool(module_key);
CREATE INDEX bp_industry_idx ON benchmark_pool(industry);
CREATE INDEX bp_period_idx ON benchmark_pool(period_label);

-- No RLS on benchmark_pool as it contains anonymized aggregate data
