-- 0402_audit_chain_order_and_fork_guard.sql
-- ARCTOS-FULL-2026-08-31 · WP4 · S03-09, plus the ordering artefact
-- behind the "5 unexplained mismatches in production" of S03-12.
--
-- ── 1. The ordering artefact ──────────────────────────────────────────
--
-- `0313` backfilled `chain_seq` with ROW_NUMBER() OVER (ORDER BY
-- created_at, id) and switched the trigger and the verifier to
-- `chain_seq`. `0328` then re-linked and rehashed the whole chain — but
-- `ORDER BY created_at, id` (0328:99). For rows written inside one
-- statement `created_at` is identical (the trigger uses `now()`), so the
-- tiebreak is a random UUID. Every such group is re-linked in an order
-- that contradicts `chain_seq`, and `LAG(entry_hash) OVER (ORDER BY
-- chain_seq)` in `/integrity` and in the anchor gate then reports a chain
-- mismatch that is not a tamper.
--
-- Measured on a database built from the migrations alone: 21 of 146
-- platform-scope rows. `scripts/dr-restore-drill.sh` calls exactly this
-- class of mismatch "known migration 0327 rehash artifact" and tolerates
-- up to ten of them — an explicit tampering budget that only exists
-- because the artefact was never traced to its cause.
--
-- The repair is deliberately **hash preserving**: it does not rehash
-- anything. It renumbers `chain_seq` so it follows the `previous_hash`
-- linkage that the rows already carry. Every `entry_hash` stays byte
-- identical, so every Merkle root and every timestamp already issued
-- stays valid. Rehashing would have been the other option and is the one
-- the audit warns about: it recomputes hashes from whatever the row
-- currently says and thereby blesses any tampering that happened first.
--
-- ── 2. The fork race (S03-09) ─────────────────────────────────────────
--
-- The advisory lock from 0343 serialises writers, but under REPEATABLE
-- READ the blocked transaction keeps the snapshot it took before the
-- lock, reads a stale chain tail and forks the chain. Reproduced by the
-- audit (evidence/S03_race_chain_fork.txt).
--
-- The sign-off chains solved the same problem correctly and at the right
-- layer: `UNIQUE NULLS NOT DISTINCT` on (parent, previous_chain_hash)
-- (migrations 0341 and 0375). A constraint is evaluated against the
-- committed state, not against the transaction snapshot, so it holds at
-- every isolation level. The same pattern is applied here.

-- ──────────────────────────────────────────────────────────────────────
-- 1. Hash-preserving chain_seq repair
-- ──────────────────────────────────────────────────────────────────────

DO $repair$
DECLARE
  v_scope    text;
  v_fixed    bigint := 0;
  v_scope_fixed bigint;
  v_base     bigint;
BEGIN
  -- The guard is ENABLE ALWAYS, so it has to be stepped around once,
  -- inside this migration, for the one column it protects that carries no
  -- evidentiary value: chain_seq is an ordering key and is not a hash
  -- input in any formula version.
  ALTER TABLE audit_log DISABLE TRIGGER audit_log_tombstone_guard;
  ALTER TABLE audit_log DISABLE TRIGGER audit_log_redaction_event_trg;

  SELECT COALESCE(max(chain_seq), 0) + 1000000 INTO v_base FROM audit_log;

  -- Only scopes whose chain_seq order actually contradicts the linkage.
  FOR v_scope IN
    WITH ordered AS (
      SELECT previous_hash_scope AS scope,
             previous_hash,
             LAG(entry_hash) OVER (
               PARTITION BY previous_hash_scope ORDER BY chain_seq
             ) AS expected_prev
      FROM audit_log
      WHERE previous_hash_scope IS NOT NULL
    )
    SELECT scope
    FROM ordered
    GROUP BY scope
    HAVING count(*) FILTER (
      WHERE COALESCE(previous_hash, '') <> COALESCE(expected_prev, '')
    ) > 0
  LOOP
    -- Only touch a scope whose pointer graph is a clean single path
    -- covering every row: exactly one head, no duplicate predecessors,
    -- and the walk reaches all rows. Anything else is a real anomaly and
    -- must be reported, not silently renumbered.
    CREATE TEMP TABLE _walk ON COMMIT DROP AS
    WITH RECURSIVE chain AS (
      SELECT id, entry_hash, 1::bigint AS ord
      FROM audit_log
      WHERE previous_hash_scope = v_scope AND previous_hash IS NULL
      UNION ALL
      SELECT a.id, a.entry_hash, c.ord + 1
      FROM audit_log a
      JOIN chain c ON a.previous_hash = c.entry_hash
      WHERE a.previous_hash_scope = v_scope
    )
    SELECT id, ord FROM chain;

    IF (SELECT count(*) FROM _walk) =
       (SELECT count(*) FROM audit_log WHERE previous_hash_scope = v_scope)
       AND (SELECT count(*) FROM audit_log
             WHERE previous_hash_scope = v_scope AND previous_hash IS NULL) = 1
    THEN
      -- Two-phase update: park the values above the current maximum first
      -- so no intermediate state collides with a row not yet renumbered.
      UPDATE audit_log a
         SET chain_seq = v_base + w.ord
        FROM _walk w
       WHERE a.id = w.id
         AND a.chain_seq IS DISTINCT FROM v_base + w.ord;
      GET DIAGNOSTICS v_scope_fixed = ROW_COUNT;
      v_fixed := v_fixed + v_scope_fixed;
      v_base := v_base + (SELECT count(*) FROM _walk) + 1000;
    ELSE
      RAISE WARNING
        '0402: scope % is not a single clean chain (rows=%, reachable=%, heads=%) — chain_seq left untouched, /integrity will report it',
        v_scope,
        (SELECT count(*) FROM audit_log WHERE previous_hash_scope = v_scope),
        (SELECT count(*) FROM _walk),
        (SELECT count(*) FROM audit_log WHERE previous_hash_scope = v_scope AND previous_hash IS NULL);
    END IF;

    DROP TABLE _walk;
  END LOOP;

  -- Keep the sequence ahead of the renumbered values.
  PERFORM setval('audit_log_chain_seq_seq',
                 GREATEST((SELECT COALESCE(max(chain_seq), 1) FROM audit_log), 1));

  ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_tombstone_guard;
  ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_redaction_event_trg;

  RAISE NOTICE '0402: chain_seq realigned with the previous_hash linkage for % row(s); no hash was recomputed', v_fixed;
END
$repair$;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Fork guard — the sign-off pattern (0341 / 0375) applied to audit_log
-- ──────────────────────────────────────────────────────────────────────

DO $fork$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_log_scope_prev_uniq'
      AND conrelid = 'audit_log'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM audit_log
      GROUP BY previous_hash_scope, previous_hash
      HAVING count(*) > 1
    ) THEN
      RAISE WARNING
        '0402: audit_log already contains forked links — UNIQUE (previous_hash_scope, previous_hash) NOT created. Resolve the fork (GET /api/v1/audit-log/integrity) and re-run this migration.';
    ELSE
      ALTER TABLE audit_log
        ADD CONSTRAINT audit_log_scope_prev_uniq
        UNIQUE NULLS NOT DISTINCT (previous_hash_scope, previous_hash);
    END IF;
  END IF;
END
$fork$;

COMMENT ON CONSTRAINT audit_log_scope_prev_uniq ON audit_log IS
  'S03-09: two entries in one scope can never claim the same predecessor. Enforced by the database, so it holds under REPEATABLE READ and SERIALIZABLE where the advisory lock from 0343 does not. Same construction as process_sign_off_chain_uq (0341).';

-- The isolation-level warning that names this constraint when it fires is
-- `audit_warn_non_read_committed()` (0400), called from
-- `audit_log_chain_assign()` (0401).
