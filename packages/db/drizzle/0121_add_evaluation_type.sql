-- Sprint 54, Migration 849: Add evaluation type + quantitative loss fields

DO $$ BEGIN
  CREATE TYPE evaluation_type AS ENUM ('qualitative', 'quantitative');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE risk ADD COLUMN IF NOT EXISTS evaluation_type evaluation_type NOT NULL DEFAULT 'qualitative';
ALTER TABLE risk ADD COLUMN IF NOT EXISTS expected_loss_min NUMERIC(15,2);
ALTER TABLE risk ADD COLUMN IF NOT EXISTS expected_loss_max NUMERIC(15,2);
ALTER TABLE risk ADD COLUMN IF NOT EXISTS expected_loss_most_likely NUMERIC(15,2);
