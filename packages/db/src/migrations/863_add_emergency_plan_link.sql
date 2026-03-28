-- Sprint 55, Migration 863: Add emergency_plan_id to work_item (incident -> BCM plan link)

ALTER TABLE work_item ADD COLUMN IF NOT EXISTS emergency_plan_id UUID REFERENCES work_item(id);
