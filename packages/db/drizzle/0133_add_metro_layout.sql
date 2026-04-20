-- Sprint 56, Migration 878: Add metro_layout JSONB to process

ALTER TABLE process ADD COLUMN IF NOT EXISTS metro_layout JSONB;
