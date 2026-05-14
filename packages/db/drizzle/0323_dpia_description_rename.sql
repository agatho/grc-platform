-- Migration 0323: rename dpia_risk.risk_description + dpia_measure.measure_description to "description".
--
-- #WAVE17-P3-DPIA: Cowork QA's Wave-14 deep test flagged the
-- inconsistent verbose names — every other module's POST schema uses
-- plain `description` (finding, risk, control, asset, ...). Wave 15
-- shipped a `.preprocess` alias so callers could send either name,
-- but the DB column + GET-response key still leaked the verbose name.
-- This migration unifies on `description` and updates the Drizzle
-- TypeScript schemas to match (next commit).
--
-- Backward-compat: the Wave-15 input alias keeps working — POST with
-- either `description` or `riskDescription` lands in the same column.
-- The only observable shift is on the GET response, which now uses
-- `description` everywhere. UI consumers reading the verbose name
-- will see undefined; we audited the codebase and found no UI usages
-- (the wizard reads `description` already because that's what its
-- form input is named).
--
-- Idempotent: IF EXISTS guards on both renames so a re-applied
-- migration is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dpia_risk' AND column_name = 'risk_description'
  ) THEN
    ALTER TABLE dpia_risk RENAME COLUMN risk_description TO description;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dpia_measure' AND column_name = 'measure_description'
  ) THEN
    ALTER TABLE dpia_measure RENAME COLUMN measure_description TO description;
  END IF;
END $$;
