-- Migration 0349b: B2.4 Release-Cycle — working copy vs. released version.
--
-- process_version.version_type:
--   'released' (default) — immutable released version
--   'working'            — editable draft copy of a published process;
--                          max. one per process, overwritten on save and
--                          promoted to 'released' on re-approval.
--
-- Note on numbering: see 0349a — the assigned 0340–0349 range was already
-- occupied; suffixed files sort between 0349_* and 0350_*.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_version_type') THEN
    CREATE TYPE process_version_type AS ENUM ('working', 'released');
  END IF;
END $$;

ALTER TABLE process_version
  ADD COLUMN IF NOT EXISTS version_type process_version_type NOT NULL DEFAULT 'released';

-- At most one working copy per process.
CREATE UNIQUE INDEX IF NOT EXISTS process_version_working_uniq
  ON process_version(process_id)
  WHERE version_type = 'working';

COMMIT;
