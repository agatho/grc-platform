-- Migration 0367: DMS malware-scan status on document_file.
--
-- Optional ClamAV scanning (clamd INSTREAM via CLAMAV_HOST/CLAMAV_PORT)
-- records its outcome per uploaded file:
--   clean    — clamd answered "stream: OK"
--   infected — never persisted in practice (infected uploads are
--              rejected with 422), kept in the CHECK for completeness
--   skipped  — scanning disabled (CLAMAV_HOST unset)
--   error    — scan failed and CLAMAV_FAIL_CLOSED was not set
--              (fail-open: the file was accepted without a verdict)
-- NULL = uploaded before scanning existed.

BEGIN;

ALTER TABLE document_file ADD COLUMN IF NOT EXISTS scan_status varchar(16);
ALTER TABLE document_file ADD COLUMN IF NOT EXISTS scanned_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_file_scan_status_check'
      AND conrelid = 'document_file'::regclass
  ) THEN
    ALTER TABLE document_file ADD CONSTRAINT document_file_scan_status_check
      CHECK (scan_status IS NULL
             OR scan_status IN ('clean', 'infected', 'skipped', 'error'));
  END IF;
END $$;

COMMIT;
