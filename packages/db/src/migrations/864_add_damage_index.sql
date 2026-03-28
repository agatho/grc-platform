-- Sprint 55, Migration 864: Add damage_index to assessment evaluations

ALTER TABLE assessment_risk_eval ADD COLUMN IF NOT EXISTS damage_index SMALLINT;
