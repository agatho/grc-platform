-- Migration 0341: Sign-off chain concurrency guard.
--
-- The 3 sign-off tables (process_sign_off, audit_sign_off, vendor_sign_off)
-- form append-only SHA-256 hash chains: each row references the previous
-- row's chain_hash via previous_chain_hash. The application reads the
-- last row's chain_hash, computes the new chain_hash, then inserts.
--
-- Without a uniqueness constraint, two concurrent POST /sign-off requests
-- can both read the same prev.chain_hash, both compute a derived chain_hash
-- on top of it, and both succeed in inserting. The result is two sibling
-- rows pointing at the same previous_chain_hash — verifyChain() then
-- reports ok=false on every subsequent GET because the linked list has
-- branched.
--
-- UNIQUE NULLS NOT DISTINCT (PostgreSQL 15+) is required because the
-- *first* sign-off on any entity has previous_chain_hash = NULL. Standard
-- UNIQUE would treat NULLs as distinct, so two concurrent first-signoffs
-- could still both succeed. NULLS NOT DISTINCT treats them as equal, so
-- the second insert fails with SQLSTATE 23505 — the application catches
-- it and returns 409 Conflict, prompting the client to retry against the
-- now-current prev.

BEGIN;

ALTER TABLE process_sign_off
  DROP CONSTRAINT IF EXISTS process_sign_off_chain_uq;
ALTER TABLE process_sign_off
  ADD CONSTRAINT process_sign_off_chain_uq
    UNIQUE NULLS NOT DISTINCT (process_id, previous_chain_hash);

ALTER TABLE audit_sign_off
  DROP CONSTRAINT IF EXISTS audit_sign_off_chain_uq;
ALTER TABLE audit_sign_off
  ADD CONSTRAINT audit_sign_off_chain_uq
    UNIQUE NULLS NOT DISTINCT (audit_id, previous_chain_hash);

ALTER TABLE vendor_sign_off
  DROP CONSTRAINT IF EXISTS vendor_sign_off_chain_uq;
ALTER TABLE vendor_sign_off
  ADD CONSTRAINT vendor_sign_off_chain_uq
    UNIQUE NULLS NOT DISTINCT (vendor_id, previous_chain_hash);

COMMIT;
