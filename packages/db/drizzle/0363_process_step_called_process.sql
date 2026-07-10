-- Migration 0363: Call-Activity Drill-Down — navigable process hierarchy
-- in the BPMN diagram.
--
-- process_step.called_process_id: the child process a call_activity /
-- (collapsed) subprocess step invokes. FK ON DELETE SET NULL so a deleted
-- target process leaves an orphaned (NULL) link instead of blocking the
-- delete. Idempotent (ADD COLUMN IF NOT EXISTS pattern, cf. 0349b).

BEGIN;

ALTER TABLE process_step
  ADD COLUMN IF NOT EXISTS called_process_id uuid
    REFERENCES process(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS process_step_called_process_idx
  ON process_step(called_process_id);

COMMIT;
