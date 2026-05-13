-- Migration 0320: deduplicate user_organization_role + enforce uniqueness.
--
-- #WAVE13-RBAC-Seed-Dups: Wave-12 QA found every test user appearing 3×
-- in /api/v1/users/{id}/roles — same org, same role, three different
-- createdAt timestamps. Root cause: the `user_organization_role` Drizzle
-- schema (packages/db/src/schema/platform.ts:283-287) declares three
-- non-unique indexes but no UNIQUE constraint on (user_id, org_id, role).
-- Migrations 0316, 0317, and 0318 all use `ON CONFLICT DO NOTHING` without
-- a target — without a UNIQUE constraint that clause is a no-op, so every
-- re-run inserted a fresh duplicate.
--
-- This migration:
--   1. Picks the canonical (oldest) row per (user_id, org_id, role) tuple
--      and soft-deletes all others. Soft-delete (deleted_at + deleted_by)
--      is preferred over DELETE because it's audit-trail-safe — the
--      append-only log already references these rows by ID.
--   2. Adds a partial unique index that ignores soft-deleted rows. Future
--      `ON CONFLICT DO NOTHING` inserts will now correctly suppress dupes,
--      and re-activating a soft-deleted row remains possible.
--
-- After this migration, the Drizzle schema's `(table) => [...]` index list
-- should gain an entry mirroring `uor_active_unique`. That ORM-level
-- declaration is purely cosmetic (Drizzle doesn't enforce the constraint
-- itself) but keeps the schema and the live DB in sync visually.

BEGIN;

-- Step 1: soft-delete duplicates, keeping the oldest createdAt per tuple.
WITH ranked AS (
  SELECT
    id,
    user_id,
    org_id,
    role,
    deleted_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, org_id, role
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM user_organization_role
  WHERE deleted_at IS NULL
)
UPDATE user_organization_role uor
SET
  deleted_at = now(),
  deleted_by = NULL  -- system-cleanup, no human actor
FROM ranked r
WHERE uor.id = r.id
  AND r.rn > 1;

-- Step 2: enforce the constraint going forward. Partial index so a soft-
-- deleted row plus a fresh active row for the same tuple is still valid.
CREATE UNIQUE INDEX IF NOT EXISTS uor_user_org_role_active_uniq
  ON user_organization_role (user_id, org_id, role)
  WHERE deleted_at IS NULL;

COMMIT;
