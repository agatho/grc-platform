-- Migration 0374: Prozesslandkarte — manuelle Sortierung der Kacheln.
--
-- process.map_sequence: manuelle Reihenfolge eines Prozesses innerhalb
-- seines Landkarten-Bands (gesetzt in 10er-Schritten via
-- PUT /api/v1/processes/map/reorder). Nullable — Prozesse ohne Sequenz
-- werden hinter den manuell sortierten alphabetisch einsortiert
-- (ORDER BY map_sequence NULLS LAST, name).
-- Idempotent (ADD COLUMN IF NOT EXISTS pattern, cf. 0373).

BEGIN;

ALTER TABLE process
  ADD COLUMN IF NOT EXISTS map_sequence integer;

CREATE INDEX IF NOT EXISTS process_map_sequence_idx
  ON process(org_id, map_category, map_sequence);

COMMIT;
