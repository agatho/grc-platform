-- Sprint 54, Migration 841: Add risk_object_type enum + column to risk table
-- Supports triple-type: risk, mixed_case, chance

DO $$ BEGIN
  CREATE TYPE risk_object_type AS ENUM ('risk', 'mixed_case', 'chance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE risk ADD COLUMN IF NOT EXISTS risk_object_type risk_object_type NOT NULL DEFAULT 'risk';

CREATE INDEX IF NOT EXISTS risk_object_type_idx ON risk (org_id, risk_object_type);
