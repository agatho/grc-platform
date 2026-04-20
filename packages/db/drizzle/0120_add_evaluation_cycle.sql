-- Sprint 54, Migration 848: Add evaluation cycle + next_evaluation_date to risk

DO $$ BEGIN
  CREATE TYPE evaluation_cycle AS ENUM ('monthly', 'quarterly', 'semi_annual', 'annual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE risk ADD COLUMN IF NOT EXISTS evaluation_cycle evaluation_cycle NOT NULL DEFAULT 'quarterly';
ALTER TABLE risk ADD COLUMN IF NOT EXISTS next_evaluation_date DATE;

CREATE INDEX IF NOT EXISTS risk_next_eval_date_idx ON risk (org_id, next_evaluation_date)
  WHERE next_evaluation_date IS NOT NULL;
