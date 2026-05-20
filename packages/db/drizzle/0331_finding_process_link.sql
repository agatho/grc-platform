-- Migration 0331: BPM Overhaul Phase 1 — Direct Finding ↔ Process link.
--
-- Today findings link to control / control_test / risk / audit / task. They
-- don't link to process directly — only transitively via control. The BPM
-- overhaul (Phase 2+) needs a direct query "all findings on process X" for
-- the Process Detail page Audits tab.
--
-- Adds finding.process_id + finding.process_step_id (both nullable, optional)
-- with indexes. Idempotent.

BEGIN;

ALTER TABLE finding
  ADD COLUMN IF NOT EXISTS process_id uuid REFERENCES process(id);

ALTER TABLE finding
  ADD COLUMN IF NOT EXISTS process_step_id uuid REFERENCES process_step(id);

CREATE INDEX IF NOT EXISTS finding_process_idx ON finding(process_id);
CREATE INDEX IF NOT EXISTS finding_process_step_idx ON finding(process_step_id);

COMMIT;
