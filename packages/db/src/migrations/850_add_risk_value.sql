-- Sprint 54, Migration 850: Add computed risk_value column (1-100)

ALTER TABLE risk ADD COLUMN IF NOT EXISTS risk_value SMALLINT;

CREATE INDEX IF NOT EXISTS risk_value_idx ON risk (org_id, risk_value)
  WHERE risk_value IS NOT NULL;
