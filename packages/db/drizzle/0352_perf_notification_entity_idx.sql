-- Migration 0352: index notification(entity_type, entity_id).
--
-- #PERF-MEDIUM-F13: the notification table has indexes on
-- (user_id, is_read) and (org_id), but lookups by entity (e.g.
-- "give me all notifications about risk X") do a seq-scan. The
-- where-used + audit-log + entity-detail pages all run a query
-- like:
--
--   SELECT * FROM notification
--   WHERE entity_type = ? AND entity_id = ?
--     AND user_id = ?
--   ORDER BY created_at DESC LIMIT N;
--
-- A composite (entity_type, entity_id) covers the predicate and is
-- selective enough that the planner uses it before filtering by
-- user_id. entity_id alone wouldn't be enough because entity_id
-- values are reused across entity types (process and risk share
-- the UUID space).
--
-- Idempotent (IF NOT EXISTS), non-concurrent per ADR-014.

BEGIN;

CREATE INDEX IF NOT EXISTS notification_entity_lookup_idx
  ON notification (entity_type, entity_id);

COMMIT;
