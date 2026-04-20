-- Sprint 56, Migration 877: Add process_health traffic light column

ALTER TABLE process ADD COLUMN IF NOT EXISTS process_health VARCHAR(10) DEFAULT 'healthy'
  CHECK (process_health IN ('healthy', 'warning', 'critical'));
