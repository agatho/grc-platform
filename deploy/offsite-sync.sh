#!/bin/bash
# ============================================================================
# ARCTOS — Off-Site Backup Sync via rclone -> Backblaze B2
#
# Ergaenzt db-backup.sh (ADR-014/015): pusht die lokalen Dumps in ein
# eu-central B2-Bucket mit Append-Only-Policy (Ransomware-resistent).
#
# Voraussetzungen:
#   - rclone installiert (apt install rclone)
#   - .rclone.conf konfiguriert mit Remote "b2-arctos" (siehe offsite-sync-setup.sh)
#   - B2-Bucket existiert, Application-Key hat writeFiles (kein deleteFiles)
#
# Aufruf via cron (nach db-backup.sh):
#   30 2 * * * root /opt/arctos/deploy/offsite-sync.sh
# ============================================================================

set -euo pipefail

BACKUP_DIR="/opt/arctos/backups"
B2_REMOTE="${B2_REMOTE:-b2-arctos:arctos-backups}"
LOG_FILE="/var/log/arctos-offsite.log"

# Only sync files modified in the last 48h -- erspart unnoetigen
# Bandwidth-Verbrauch, falls der Cron mehrfach laeuft.
MAX_AGE_HOURS=48

if ! command -v rclone >/dev/null 2>&1; then
  echo "{\"error\":\"rclone not installed\",\"timestamp\":\"$(date -u -Iseconds)\"}" >> "$LOG_FILE"
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "{\"error\":\"backup dir missing\",\"path\":\"$BACKUP_DIR\",\"timestamp\":\"$(date -u -Iseconds)\"}" >> "$LOG_FILE"
  exit 1
fi

START_TS=$(date -u +%s)

# Sync only recently-changed files. --update preserves newest; --no-traverse
# skips a full listing of B2 (cheaper API calls).
UPLOAD_COUNT=0
for f in $(find "$BACKUP_DIR" -type f \( -name "*.dump" -o -name "*.sql.gz" -o -name "*.sha256" \) -mmin -$((MAX_AGE_HOURS*60))); do
  BASENAME=$(basename "$f")
  SIZE=$(stat -c%s "$f" 2>/dev/null || echo 0)
  SUB_START=$(date -u +%s%3N)
  if rclone copyto "$f" "$B2_REMOTE/$BASENAME" --immutable --no-traverse 2>/dev/null; then
    SUB_END=$(date -u +%s%3N)
    DURATION_MS=$((SUB_END - SUB_START))
    UPLOAD_COUNT=$((UPLOAD_COUNT + 1))
    echo "{\"timestamp\":\"$(date -u -Iseconds)\",\"file\":\"$BASENAME\",\"size_bytes\":$SIZE,\"upload_duration_ms\":$DURATION_MS,\"remote\":\"$B2_REMOTE/$BASENAME\"}" >> "$LOG_FILE"
  else
    echo "{\"timestamp\":\"$(date -u -Iseconds)\",\"file\":\"$BASENAME\",\"error\":\"rclone copy failed\"}" >> "$LOG_FILE"
  fi
done

END_TS=$(date -u +%s)
echo "{\"timestamp\":\"$(date -u -Iseconds)\",\"summary\":{\"uploaded\":$UPLOAD_COUNT,\"total_duration_s\":$((END_TS - START_TS))}}" >> "$LOG_FILE"
