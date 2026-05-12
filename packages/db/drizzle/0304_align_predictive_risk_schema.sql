-- #NIGHT-028 / #NIGHT-029: GET /api/v1/predictive-risk/models and
-- /predictions were 500-crashing because the DB schema for
-- risk_prediction_model / risk_prediction is from Sprint 33
-- (migration 0045), but the Drizzle TS schema in
-- packages/db/src/schema/predictive-risk.ts is from Sprint 71
-- (migration 0071). Migration 0071 used CREATE TABLE IF NOT EXISTS,
-- so it was a no-op when 0045 had already created the tables — and
-- the columns Drizzle .select() asks for don't exist.
--
-- Strategy: ADD missing Sprint-71 columns and relax the Sprint-33
-- NOT NULLs so inserts work via either schema. The Sprint-33 columns
-- become legacy / nullable; the Sprint-71 columns are the path
-- forward.
--
-- We do NOT drop+recreate because (a) other tables FK to these
-- (risk_prediction_alert references model.id) and (b) any rows that
-- did get persisted would be lost.

-- ──────────────────────────────────────────────────────────────
-- risk_prediction_model
-- ──────────────────────────────────────────────────────────────

ALTER TABLE risk_prediction_model
  ADD COLUMN IF NOT EXISTS name VARCHAR(500),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS model_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS target_metric VARCHAR(100),
  ADD COLUMN IF NOT EXISTS input_features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hyperparameters JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS training_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accuracy NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS last_trained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS training_samples INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model_state JSONB,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'untrained',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES "user"(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Sprint-33 NOT NULL columns become nullable so inserts via the
-- Sprint-71 path don't have to set them.
ALTER TABLE risk_prediction_model
  ALTER COLUMN version DROP NOT NULL,
  ALTER COLUMN feature_importance_json DROP NOT NULL,
  ALTER COLUMN training_metrics DROP NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- risk_prediction
-- ──────────────────────────────────────────────────────────────

ALTER TABLE risk_prediction
  ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES risk_prediction_model(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS prediction_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS current_value NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS predicted_value NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS confidence_interval JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trend_direction VARCHAR(20),
  ADD COLUMN IF NOT EXISTS trend_strength NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS early_warning BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_warning_message TEXT,
  ADD COLUMN IF NOT EXISTS contributing_factors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correlated_entities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE risk_prediction
  ALTER COLUMN risk_id DROP NOT NULL,
  ALTER COLUMN escalation_probability DROP NOT NULL,
  ALTER COLUMN features_json DROP NOT NULL,
  ALTER COLUMN top_factors_json DROP NOT NULL,
  ALTER COLUMN model_version DROP NOT NULL;
