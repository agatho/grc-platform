#!/usr/bin/env bash
# Install backup + rotation cron on the ARCTOS server.
#
# Sets up:
#   - Daily pg_dump at 03:00 UTC (via /etc/cron.d/arctos-backup)
#   - 14-day retention + size-capped cleanup
#   - A healthcheck record at /opt/arctos/backups/.last-run
#
# Run once as root:
#   sudo bash deploy/backup-cron-install.sh
#
# Idempotent — re-running replaces the cron + retention script.

set -euo pipefail

BACKUP_DIR="/opt/arctos/backups"
CRON_FILE="/etc/cron.d/arctos-backup"
ROTATE_SCRIPT="/opt/arctos/deploy/backup-rotate.sh"
BACKUP_SCRIPT="/opt/arctos/deploy/db-backup.sh"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "must be run as root (sudo)" >&2
  exit 1
fi

if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "db-backup.sh not found at $BACKUP_SCRIPT" >&2
  exit 1
fi

# ── Rotation script — keeps the last 14 daily backups per DB and
#    caps total size at 5 GB (oldest evicted first if over).
cat > "$ROTATE_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/opt/arctos/backups"
KEEP_DAYS=14
SIZE_CAP_BYTES=$((5 * 1024 * 1024 * 1024))  # 5 GB

# Per-DB daily retention: keep last KEEP_DAYS, delete older.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.sql.gz' -o -name '*.sha256' \) \
  -mtime "+${KEEP_DAYS}" -print -delete

# Hard cap: if total > SIZE_CAP_BYTES, drop the oldest files until under.
while :; do
  USED=$(du -sb "$BACKUP_DIR" | awk '{print $1}')
  [ "$USED" -le "$SIZE_CAP_BYTES" ] && break
  OLDEST=$(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.sql.gz' \) -printf '%T@ %p\n' \
    | sort -n | head -1 | awk '{print $2}')
  [ -z "$OLDEST" ] && break
  # Drop the binary dump + its sidecar sha256 + its sql.gz sibling.
  BASE="${OLDEST%.dump}"
  BASE="${BASE%.sql.gz}"
  rm -fv "${BASE}.dump" "${BASE}.dump.sha256" "${BASE}.sql.gz" 2>/dev/null || true
done

# Healthcheck stamp — ages older than 25h mean backups are stale.
date -u +%FT%TZ > "$BACKUP_DIR/.last-run"
EOF
chmod +x "$ROTATE_SCRIPT"

# ── Cron entry. Daily 03:00 UTC → db-backup.sh → rotate.
cat > "$CRON_FILE" <<EOF
# ARCTOS — nightly database backup + rotation
# Installed by deploy/backup-cron-install.sh — regenerate, do not hand-edit.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

0 3 * * * root ${BACKUP_SCRIPT} >>${BACKUP_DIR}/cron.log 2>&1 && ${ROTATE_SCRIPT} >>${BACKUP_DIR}/cron.log 2>&1
EOF
chmod 0644 "$CRON_FILE"

mkdir -p "$BACKUP_DIR"
chown -R arctos:arctos "$BACKUP_DIR"

echo "Installed:"
echo "  $CRON_FILE"
echo "  $ROTATE_SCRIPT"
echo ""
echo "Verify with:"
echo "  sudo ${BACKUP_SCRIPT}           # manual backup now"
echo "  ls -la ${BACKUP_DIR}"
echo "  cat ${BACKUP_DIR}/.last-run"
