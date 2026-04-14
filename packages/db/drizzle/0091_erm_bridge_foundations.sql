-- Migration 0091: ERM Bridge Foundations
-- Extends risk_source enum + adds riskId FK to all domain risk tables
-- Pattern: Domain risk → auto-sync to central ERM register when score ≥ threshold

-- ============================================================
-- 1. Extend risk_source enum
-- ============================================================

ALTER TYPE risk_source ADD VALUE IF NOT EXISTS 'dpms';
ALTER TYPE risk_source ADD VALUE IF NOT EXISTS 'tprm';
ALTER TYPE risk_source ADD VALUE IF NOT EXISTS 'esg';

-- ============================================================
-- 2. TPRM: vendor_risk_assessment → ERM bridge
-- ============================================================

ALTER TABLE vendor_risk_assessment ADD COLUMN IF NOT EXISTS erm_risk_id UUID REFERENCES risk(id);
ALTER TABLE vendor_risk_assessment ADD COLUMN IF NOT EXISTS erm_synced_at TIMESTAMPTZ;
ALTER TABLE vendor_risk_assessment ADD COLUMN IF NOT EXISTS erm_sync_threshold INTEGER DEFAULT 15;

-- LkSG assessment → ERM bridge
ALTER TABLE lksg_assessment ADD COLUMN IF NOT EXISTS erm_risk_id UUID REFERENCES risk(id);
ALTER TABLE lksg_assessment ADD COLUMN IF NOT EXISTS erm_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vra_erm_risk ON vendor_risk_assessment(erm_risk_id) WHERE erm_risk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lksg_erm_risk ON lksg_assessment(erm_risk_id) WHERE erm_risk_id IS NOT NULL;

-- ============================================================
-- 3. DPMS: dpia_risk → ERM bridge + numeric scoring
-- ============================================================

ALTER TABLE dpia_risk ADD COLUMN IF NOT EXISTS numeric_likelihood INTEGER CHECK (numeric_likelihood BETWEEN 1 AND 5);
ALTER TABLE dpia_risk ADD COLUMN IF NOT EXISTS numeric_impact INTEGER CHECK (numeric_impact BETWEEN 1 AND 5);
ALTER TABLE dpia_risk ADD COLUMN IF NOT EXISTS risk_score INTEGER GENERATED ALWAYS AS (
  COALESCE(numeric_likelihood, 0) * COALESCE(numeric_impact, 0)
) STORED;
ALTER TABLE dpia_risk ADD COLUMN IF NOT EXISTS erm_risk_id UUID REFERENCES risk(id);
ALTER TABLE dpia_risk ADD COLUMN IF NOT EXISTS erm_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dpia_risk_erm ON dpia_risk(erm_risk_id) WHERE erm_risk_id IS NOT NULL;

-- Backfill numeric scores from string values
UPDATE dpia_risk SET
  numeric_likelihood = CASE severity WHEN 'critical' THEN 5 WHEN 'high' THEN 4 WHEN 'medium' THEN 3 WHEN 'low' THEN 2 ELSE 1 END,
  numeric_impact = CASE impact WHEN 'critical' THEN 5 WHEN 'high' THEN 4 WHEN 'medium' THEN 3 WHEN 'low' THEN 2 ELSE 1 END
WHERE numeric_likelihood IS NULL;

-- ============================================================
-- 4. BCMS: crisis_scenario → ERM bridge + likelihood
-- ============================================================

ALTER TABLE crisis_scenario ADD COLUMN IF NOT EXISTS likelihood INTEGER CHECK (likelihood BETWEEN 1 AND 5);
ALTER TABLE crisis_scenario ADD COLUMN IF NOT EXISTS risk_score INTEGER;
ALTER TABLE crisis_scenario ADD COLUMN IF NOT EXISTS erm_risk_id UUID REFERENCES risk(id);
ALTER TABLE crisis_scenario ADD COLUMN IF NOT EXISTS erm_synced_at TIMESTAMPTZ;
ALTER TABLE crisis_scenario ADD COLUMN IF NOT EXISTS treatment_strategy VARCHAR(20) DEFAULT 'mitigate';

CREATE INDEX IF NOT EXISTS idx_crisis_erm_risk ON crisis_scenario(erm_risk_id) WHERE erm_risk_id IS NOT NULL;

-- Backfill likelihood from severity
UPDATE crisis_scenario SET
  likelihood = CASE severity
    WHEN 'critical' THEN 4
    WHEN 'high' THEN 3
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 1
    ELSE 2
  END
WHERE likelihood IS NULL;

-- Compute risk_score (severity_level × likelihood)
UPDATE crisis_scenario SET
  risk_score = likelihood * CASE severity
    WHEN 'critical' THEN 5
    WHEN 'high' THEN 4
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 2
    ELSE 2
  END
WHERE risk_score IS NULL;

-- ============================================================
-- 5. ESG: materiality_iro → ERM bridge
-- ============================================================

ALTER TABLE materiality_iro ADD COLUMN IF NOT EXISTS erm_risk_id UUID REFERENCES risk(id);
ALTER TABLE materiality_iro ADD COLUMN IF NOT EXISTS erm_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mat_iro_erm ON materiality_iro(erm_risk_id) WHERE erm_risk_id IS NOT NULL;

-- ============================================================
-- 6. Config: ERM sync thresholds per module
-- ============================================================

CREATE TABLE IF NOT EXISTS erm_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  module_key VARCHAR(50) NOT NULL,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  score_threshold INTEGER NOT NULL DEFAULT 15,
  auto_create_risk BOOLEAN NOT NULL DEFAULT true,
  default_risk_category VARCHAR(50) NOT NULL DEFAULT 'operational',
  default_treatment_strategy VARCHAR(20) NOT NULL DEFAULT 'mitigate',
  notify_risk_manager BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, module_key)
);

ALTER TABLE erm_sync_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY rls_erm_sync_config ON erm_sync_config USING (org_id = current_setting('app.current_org_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Default configs
INSERT INTO erm_sync_config (org_id, module_key, score_threshold, default_risk_category) VALUES
('c2446a5c-64f1-40a7-862a-8ab084f66f41', 'tprm', 15, 'operational'),
('c2446a5c-64f1-40a7-862a-8ab084f66f41', 'dpms', 12, 'compliance'),
('c2446a5c-64f1-40a7-862a-8ab084f66f41', 'bcms', 12, 'operational'),
('c2446a5c-64f1-40a7-862a-8ab084f66f41', 'esg', 15, 'esg')
ON CONFLICT DO NOTHING;
