-- Sprint 54, Migration 843: Add evaluation_phase enum + column to risk table

DO $$ BEGIN
  CREATE TYPE evaluation_phase AS ENUM (
    'assignment', 'gross_evaluation', 'net_evaluation', 'approval', 'active'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE risk ADD COLUMN IF NOT EXISTS evaluation_phase evaluation_phase NOT NULL DEFAULT 'assignment';

CREATE INDEX IF NOT EXISTS risk_evaluation_phase_idx ON risk (org_id, evaluation_phase);
