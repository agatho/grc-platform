-- Sprint 54, Migration 846: Add ESG relevance flag to risk table

ALTER TABLE risk ADD COLUMN IF NOT EXISTS is_esg_relevant BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS risk_esg_relevant_idx ON risk (org_id, is_esg_relevant) WHERE is_esg_relevant = true;
