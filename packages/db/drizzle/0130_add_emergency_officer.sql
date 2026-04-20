-- Sprint 55, Migration 867: Add emergency_officer_id to bc_process

ALTER TABLE bc_process ADD COLUMN IF NOT EXISTS emergency_officer_id UUID REFERENCES "user"(id);
