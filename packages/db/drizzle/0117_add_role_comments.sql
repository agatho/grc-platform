-- Sprint 54, Migration 845: Add role-specific comment fields to risk table

ALTER TABLE risk ADD COLUMN IF NOT EXISTS comment_risk_owner TEXT;
ALTER TABLE risk ADD COLUMN IF NOT EXISTS comment_risk_manager TEXT;
ALTER TABLE risk ADD COLUMN IF NOT EXISTS comment_management TEXT;
