-- Migration 0335: BPM Overhaul Phase 2 — make process_framework_mapping more flexible.
--
-- Originally we required catalog_entry_id; AI suggestions can't always be
-- resolved to a seeded catalog_entry. We now:
--   1. Make catalog_entry_id NULLABLE.
--   2. Add entry_code (varchar 50) so we can still record "ISO 27001 A.5.1"
--      even when the catalog entry isn't in our seeds.
--   3. Replace the (process_id, catalog_entry_id) unique index with
--      (process_id, COALESCE(catalog_entry_id::text, '') ||
--       COALESCE(framework_code, '') || COALESCE(entry_code, '')).
--   4. Add resolution status column so UI can flag "unresolved" mappings.

BEGIN;

ALTER TABLE process_framework_mapping
  ALTER COLUMN catalog_entry_id DROP NOT NULL;

ALTER TABLE process_framework_mapping
  ADD COLUMN IF NOT EXISTS entry_code varchar(50);

ALTER TABLE process_framework_mapping
  ADD COLUMN IF NOT EXISTS entry_title text;

-- Drop old strict uniqueness, add a more permissive functional index
DROP INDEX IF EXISTS pfm_process_entry_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS pfm_process_resolved_uniq
  ON process_framework_mapping (
    process_id,
    COALESCE(catalog_entry_id::text, ''),
    COALESCE(framework_code, ''),
    COALESCE(entry_code, '')
  );

COMMIT;
