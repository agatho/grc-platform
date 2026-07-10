-- Migration 0353: DMS Paket D1 — Effective Dating + Major/Minor versioning
-- on document_version.
--
-- Adds the effective-dating window (valid_from / valid_until, NULL = open)
-- and the human-readable major.minor version label. Backfill strategy:
--   valid_from    = created_at
--   valid_until   = valid_from of the successor version (LEAD window fn)
--   version_major = version_number, version_minor = 0  → label "N.0"
-- so every pre-existing integer version becomes its own major version.

BEGIN;

ALTER TABLE document_version ADD COLUMN IF NOT EXISTS valid_from timestamptz;
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS valid_until timestamptz;
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS version_label varchar(20);
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS version_major integer;
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS version_minor integer;

-- Backfill: window starts when the version row was created
UPDATE document_version
SET valid_from = created_at
WHERE valid_from IS NULL;

-- Backfill: window ends when the successor version starts
UPDATE document_version dv
SET valid_until = nxt.next_valid_from
FROM (
  SELECT id,
         LEAD(valid_from) OVER (
           PARTITION BY document_id
           ORDER BY version_number
         ) AS next_valid_from
  FROM document_version
) nxt
WHERE dv.id = nxt.id
  AND dv.valid_until IS NULL
  AND nxt.next_valid_from IS NOT NULL;

-- Backfill: legacy integer versions become majors ("3" → "3.0")
UPDATE document_version
SET version_major = version_number,
    version_minor = 0,
    version_label = version_number::text || '.0'
WHERE version_major IS NULL;

CREATE INDEX IF NOT EXISTS dv_document_valid_from_idx
  ON document_version(document_id, valid_from);

COMMIT;
