-- Migration 0330: BPM Overhaul Phase 1 — FK hardening for placeholder tables.
--
-- Background: process_control.control_id, process_step_control.control_id,
-- process_document.document_id, process_risk.process_id, and
-- process_step_risk.process_step_id were created as plain uuid columns
-- without FK constraints, originally to avoid circular-dep / cross-domain
-- migration ordering issues. Now (post Wave-23) we harden them.
--
-- Strategy:
--   1. Drop orphaned rows (where the target row does not exist) so the FK
--      doesn't choke on add. We log how many we drop.
--   2. Add FK constraints with ON DELETE CASCADE.
--   3. Add indexes on FK columns (some already exist; IF NOT EXISTS).
--
-- This is fully idempotent: every constraint/index is guarded.
-- Reversible via `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...`.

BEGIN;

-- ─── 1. process_control.control_id → control(id) ────────────────────────────
DO $$
DECLARE
  orphans int;
BEGIN
  DELETE FROM process_control pc
    WHERE NOT EXISTS (SELECT 1 FROM control c WHERE c.id = pc.control_id);
  GET DIAGNOSTICS orphans = ROW_COUNT;
  IF orphans > 0 THEN
    RAISE NOTICE '[0330] dropped % orphaned process_control rows', orphans;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_control_control_fk'
  ) THEN
    ALTER TABLE process_control
      ADD CONSTRAINT process_control_control_fk
      FOREIGN KEY (control_id) REFERENCES control(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS process_control_control_fk_idx
  ON process_control(control_id);

-- ─── 2. process_step_control.control_id → control(id) ──────────────────────
DO $$
DECLARE
  orphans int;
BEGIN
  DELETE FROM process_step_control psc
    WHERE NOT EXISTS (SELECT 1 FROM control c WHERE c.id = psc.control_id);
  GET DIAGNOSTICS orphans = ROW_COUNT;
  IF orphans > 0 THEN
    RAISE NOTICE '[0330] dropped % orphaned process_step_control rows', orphans;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_step_control_control_fk'
  ) THEN
    ALTER TABLE process_step_control
      ADD CONSTRAINT process_step_control_control_fk
      FOREIGN KEY (control_id) REFERENCES control(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS process_step_control_control_fk_idx
  ON process_step_control(control_id);

-- ─── 3. process_document.document_id → document(id) ────────────────────────
DO $$
DECLARE
  orphans int;
BEGIN
  DELETE FROM process_document pd
    WHERE NOT EXISTS (SELECT 1 FROM document d WHERE d.id = pd.document_id);
  GET DIAGNOSTICS orphans = ROW_COUNT;
  IF orphans > 0 THEN
    RAISE NOTICE '[0330] dropped % orphaned process_document rows', orphans;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_document_document_fk'
  ) THEN
    ALTER TABLE process_document
      ADD CONSTRAINT process_document_document_fk
      FOREIGN KEY (document_id) REFERENCES document(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 4. process_risk.process_id → process(id) ──────────────────────────────
DO $$
DECLARE
  orphans int;
BEGIN
  DELETE FROM process_risk pr
    WHERE NOT EXISTS (SELECT 1 FROM process p WHERE p.id = pr.process_id);
  GET DIAGNOSTICS orphans = ROW_COUNT;
  IF orphans > 0 THEN
    RAISE NOTICE '[0330] dropped % orphaned process_risk rows', orphans;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_risk_process_fk'
  ) THEN
    ALTER TABLE process_risk
      ADD CONSTRAINT process_risk_process_fk
      FOREIGN KEY (process_id) REFERENCES process(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 5. process_step_risk.process_step_id → process_step(id) ───────────────
DO $$
DECLARE
  orphans int;
BEGIN
  DELETE FROM process_step_risk psr
    WHERE NOT EXISTS (SELECT 1 FROM process_step ps WHERE ps.id = psr.process_step_id);
  GET DIAGNOSTICS orphans = ROW_COUNT;
  IF orphans > 0 THEN
    RAISE NOTICE '[0330] dropped % orphaned process_step_risk rows', orphans;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_step_risk_step_fk'
  ) THEN
    ALTER TABLE process_step_risk
      ADD CONSTRAINT process_step_risk_step_fk
      FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS process_step_risk_step_fk_idx
  ON process_step_risk(process_step_id);

-- ─── Diagnostic summary ────────────────────────────────────────────────────
DO $$
DECLARE
  fk_count int;
BEGIN
  SELECT COUNT(*) INTO fk_count
    FROM pg_constraint
    WHERE conname IN (
      'process_control_control_fk',
      'process_step_control_control_fk',
      'process_document_document_fk',
      'process_risk_process_fk',
      'process_step_risk_step_fk'
    );
  RAISE NOTICE '[0330] BPM placeholder FK hardening: % of 5 FKs present', fk_count;
END $$;

COMMIT;
