-- Migration: usage_record idempotency-key
--
-- Triage finding F#7 (alpha-blocker): the POST /api/v1/usage endpoint
-- inserts a usage_record on every call. Retried requests (network flap,
-- client retry library, queue replay) therefore double-bill the customer.
--
-- Fix:
-- 1. Add nullable idempotency_key column (varchar(128)).
-- 2. Partial unique index on (org_id, idempotency_key) where the key is
--    present. Keeps existing rows (and rows from callers that didn't
--    supply a key) unaffected.
--
-- The route handler will read an `Idempotency-Key` HTTP header (or
-- top-level field) and pass it into the insert. The unique index lets
-- Postgres reject duplicates via constraint violation; the route catches
-- that and returns the previously-stored row (200) instead of inserting
-- a second one (the standard idempotency-key pattern from RFC 9457bis).

ALTER TABLE usage_record
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(128);

CREATE UNIQUE INDEX IF NOT EXISTS usage_record_idem_uq
  ON usage_record (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN usage_record.idempotency_key IS
  'Optional caller-supplied key (RFC 9457bis style). Two requests with the same (org_id, idempotency_key) collapse to one row.';
