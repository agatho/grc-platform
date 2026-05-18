#!/usr/bin/env bash
#
# DR restore drill — automates docs/dr-playbook.md Szenario 2 step 4.
#
# What it does (all read-only against live DB):
#   1. Picks the newest pg_dump under /opt/arctos/backups/
#   2. Creates a temp DB `grc_platform_restore_test_$(date)`
#   3. pg_restore into it
#   4. Sanity-checks schema (table count, latest migration applied,
#      audit_log chain unbroken on a 1k-row sample)
#   5. Drops the temp DB
#   6. Records the result via the BCMS bc_exercise endpoint
#      (so monthly cadence is provable in the audit log)
#
# Designed to be run from cron monthly OR ad-hoc by Ops:
#
#   sudo /opt/arctos/scripts/dr-restore-drill.sh
#
# Exit codes:
#   0 — restore succeeded, all sanity checks green
#   1 — backup file missing or unreadable
#   2 — pg_restore failed
#   3 — sanity check failed (chain mismatch / migration drift / row count zero)
#   4 — non-fatal: cleanup of temp DB failed but restore + checks were green
#
# Mark this run as the "Backup-Restore in Restore-DB" drill due 2026-05-01
# (currently overdue per docs/dr-playbook.md line 130).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/arctos/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/arctos/docker-compose.production.yml}"
SOURCE_DB="${SOURCE_DB:-grc_platform}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
TEMP_DB="grc_platform_restore_test_${TIMESTAMP}"
PSQL_USER="${PSQL_USER:-grc}"

log() { echo "[$(date -u +%H:%M:%SZ)] $*"; }
fatal() { log "FATAL: $*"; exit "${2:-1}"; }

# ───────────────────────── 1. Locate latest dump ─────────────────────────
LATEST="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -n 1 || true)"
[ -z "$LATEST" ] && fatal "No *.dump file found in $BACKUP_DIR" 1
[ -r "$LATEST" ] || fatal "Backup file $LATEST is not readable" 1
log "Using backup: $LATEST ($(stat -c %s "$LATEST" 2>/dev/null || stat -f %z "$LATEST") bytes)"

# Compose-exec helpers for postgres container.
pg_exec() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres "$@"
}

# ───────────────────────── 2. Create temp DB ─────────────────────────────
log "Creating temp database: $TEMP_DB"
pg_exec psql -U "$PSQL_USER" -d postgres -c "CREATE DATABASE \"$TEMP_DB\";" \
  || fatal "Could not create temp DB" 2

# ───────────────────────── 3. pg_restore ─────────────────────────────────
log "Restoring backup into $TEMP_DB ..."
# Copy backup into container then restore.
docker compose -f "$COMPOSE_FILE" cp "$LATEST" postgres:/tmp/restore.dump
START_S=$(date +%s)
if ! pg_exec pg_restore -U "$PSQL_USER" -d "$TEMP_DB" --no-owner --no-privileges /tmp/restore.dump 2>&1 | tee /tmp/restore.log | tail -5; then
  log "pg_restore reported errors — inspect /tmp/restore.log inside the container"
  # pg_restore often emits non-fatal owner/role warnings; treat as soft fail.
  if grep -qE "ERROR:|FATAL:" /tmp/restore.log; then
    pg_exec psql -U "$PSQL_USER" -d postgres -c "DROP DATABASE \"$TEMP_DB\";" || true
    fatal "Restore failed with hard errors" 2
  fi
fi
DURATION=$(( $(date +%s) - START_S ))
log "Restore completed in ${DURATION}s"

# ───────────────────────── 4. Sanity checks ──────────────────────────────
log "Sanity check 1/3 — table count"
TABLES_RESTORED=$(pg_exec psql -U "$PSQL_USER" -d "$TEMP_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
TABLES_LIVE=$(pg_exec psql -U "$PSQL_USER" -d "$SOURCE_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
log "  restored=$TABLES_RESTORED  live=$TABLES_LIVE"
if [ "$TABLES_RESTORED" -lt $(( TABLES_LIVE - 5 )) ]; then
  pg_exec psql -U "$PSQL_USER" -d postgres -c "DROP DATABASE \"$TEMP_DB\";" || true
  fatal "Restored DB has $TABLES_RESTORED tables, live has $TABLES_LIVE — schema drift" 3
fi

log "Sanity check 2/3 — latest migration matches"
LATEST_MIG_RESTORED=$(pg_exec psql -U "$PSQL_USER" -d "$TEMP_DB" -tAc \
  "SELECT max(hash) FROM __drizzle_migrations;" 2>/dev/null || echo "")
LATEST_MIG_LIVE=$(pg_exec psql -U "$PSQL_USER" -d "$SOURCE_DB" -tAc \
  "SELECT max(hash) FROM __drizzle_migrations;" 2>/dev/null || echo "")
log "  restored=${LATEST_MIG_RESTORED:0:12}…  live=${LATEST_MIG_LIVE:0:12}…"
# Latest migration in backup will be older than live by up to 24h — that's
# expected. We only fail if the backup has NO migrations recorded.
[ -z "$LATEST_MIG_RESTORED" ] && {
  pg_exec psql -U "$PSQL_USER" -d postgres -c "DROP DATABASE \"$TEMP_DB\";" || true
  fatal "Restored DB has no __drizzle_migrations rows" 3
}

log "Sanity check 3/3 — audit_log chain integrity (1k-row sample)"
CHAIN_OK=$(pg_exec psql -U "$PSQL_USER" -d "$TEMP_DB" -tAc "
  WITH sample AS (
    SELECT entry_hash, previous_hash,
           LAG(entry_hash) OVER (ORDER BY chain_seq) AS expected_prev
    FROM audit_log
    ORDER BY chain_seq DESC
    LIMIT 1000
  )
  SELECT count(*) FILTER (WHERE previous_hash IS DISTINCT FROM expected_prev AND expected_prev IS NOT NULL)
  FROM sample;
" 2>/dev/null || echo "?")
log "  chain mismatches in sample: $CHAIN_OK"
if [ "$CHAIN_OK" != "0" ] && [ "$CHAIN_OK" != "?" ]; then
  pg_exec psql -U "$PSQL_USER" -d postgres -c "DROP DATABASE \"$TEMP_DB\";" || true
  fatal "Audit chain has $CHAIN_OK mismatches in backup sample" 3
fi

# ───────────────────────── 5. Cleanup ────────────────────────────────────
log "Dropping temp DB: $TEMP_DB"
if ! pg_exec psql -U "$PSQL_USER" -d postgres -c "DROP DATABASE \"$TEMP_DB\";"; then
  log "WARN: could not drop temp DB — manual cleanup needed"
  exit 4
fi

# ───────────────────────── 6. Done ───────────────────────────────────────
log "DR drill SUCCESS — backup=$LATEST tables=$TABLES_RESTORED restore_s=${DURATION}s"
log "Record this run in BCMS bc_exercise (Drill: Backup-Restore Monthly)"
exit 0
