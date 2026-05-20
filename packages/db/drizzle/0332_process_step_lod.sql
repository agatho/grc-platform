-- Migration 0332: BPM Overhaul Phase 1 — Three-Lines-of-Defense per process_step.
--
-- Today LoD is implicit: a `role` is 1st/2nd/3rd line via custom_role/system_role_key.
-- We need explicit per-step LoD assignment for the BPMN heatmap, RACM matrix, and
-- the Lane-color overlay. Defaults to NULL = inherit from process role mapping.
--
-- Also stores the explicit RACI responsible/accountable role refs per step,
-- so the per-step override can be persisted without an extra table for the
-- common case (Phase 3 uses a separate process_step_raci_override for full
-- I and C lists).

BEGIN;

-- Enum: lod_enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lod_enum') THEN
    CREATE TYPE lod_enum AS ENUM ('first', 'second', 'third', 'oversight');
  END IF;
END $$;

-- process_step columns
ALTER TABLE process_step
  ADD COLUMN IF NOT EXISTS line_of_defense lod_enum;

ALTER TABLE process_step
  ADD COLUMN IF NOT EXISTS raci_responsible_role_id uuid;

ALTER TABLE process_step
  ADD COLUMN IF NOT EXISTS raci_accountable_role_id uuid;

-- Reference custom_role(id) softly: FK if table exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'custom_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'process_step_raci_responsible_fk'
    ) THEN
      ALTER TABLE process_step
        ADD CONSTRAINT process_step_raci_responsible_fk
        FOREIGN KEY (raci_responsible_role_id) REFERENCES custom_role(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'process_step_raci_accountable_fk'
    ) THEN
      ALTER TABLE process_step
        ADD CONSTRAINT process_step_raci_accountable_fk
        FOREIGN KEY (raci_accountable_role_id) REFERENCES custom_role(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Index for LoD heatmap aggregation queries
CREATE INDEX IF NOT EXISTS process_step_lod_idx
  ON process_step(process_id, line_of_defense);

-- Also expose LoD on process itself (process-level default for steps that don't override)
ALTER TABLE process
  ADD COLUMN IF NOT EXISTS default_line_of_defense lod_enum;

ALTER TABLE process
  ADD COLUMN IF NOT EXISTS is_critical_process boolean NOT NULL DEFAULT false;

ALTER TABLE process
  ADD COLUMN IF NOT EXISTS criticality_rationale text;

CREATE INDEX IF NOT EXISTS process_critical_idx
  ON process(org_id, is_critical_process) WHERE is_critical_process = true;

COMMIT;
