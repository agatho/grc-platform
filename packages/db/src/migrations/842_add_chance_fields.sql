-- Sprint 54, Migration 842: Add chance/benefit fields to risk table

ALTER TABLE risk ADD COLUMN IF NOT EXISTS expected_benefit TEXT;
ALTER TABLE risk ADD COLUMN IF NOT EXISTS benefit_category VARCHAR(30);
