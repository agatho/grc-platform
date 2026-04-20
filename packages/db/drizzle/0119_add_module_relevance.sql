-- Sprint 54, Migration 847: Add module relevance JSONB flags to risk table

ALTER TABLE risk ADD COLUMN IF NOT EXISTS module_relevance JSONB NOT NULL DEFAULT '{}';
