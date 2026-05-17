-- Migration 0339: DPMS Overhaul — bridge ropa_entry ↔ process_ropa_profile,
-- + data_breach.process_ids[] for cross-module impact.

BEGIN;

-- 1. ropa_entry.process_id — optional link to a process whose ROPA profile is the source of truth
ALTER TABLE ropa_entry
  ADD COLUMN IF NOT EXISTS process_id uuid REFERENCES process(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ropa_entry_process_idx ON ropa_entry(process_id);

-- 2. data_breach: list of process IDs whose data was breached
ALTER TABLE data_breach
  ADD COLUMN IF NOT EXISTS affected_process_ids uuid[] DEFAULT '{}'::uuid[];

-- 3. dpia.process_id (optional link back to the originating process for auto-created DPIAs)
ALTER TABLE dpia
  ADD COLUMN IF NOT EXISTS process_id uuid REFERENCES process(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dpia_process_idx ON dpia(process_id);

COMMIT;
