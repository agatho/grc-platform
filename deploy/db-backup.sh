#!/bin/bash
# ============================================================================
# ARCTOS — DB Backup Script
#
# Führt einen Point-in-Time-Dump von einer oder allen Tenant-DBs durch.
# Custom-Format für pg_restore + Plain-SQL für Inspektion.
#
# Verwendung auf dem Hetzner-Host:
#   sudo bash deploy/db-backup.sh                   # alle Tenant-DBs + Haupt-DB
#   sudo bash deploy/db-backup.sh grc_daimon        # nur eine DB
#   sudo bash deploy/db-backup.sh --pre-migration   # wie "alle", zusätzlich Markierung
#
# Wiederherstellung einer einzelnen DB (manuell):
#   # 1. Container stoppen, der die DB nutzt
#   docker compose -f /opt/arctos/docker-compose.production.yml stop web web-daimon
#   # 2. DB leeren
#   docker compose -f /opt/arctos/docker-compose.production.yml exec -T postgres psql -U grc -d postgres -c "DROP DATABASE grc_daimon; CREATE DATABASE grc_daimon OWNER grc;"
#   # 3. Custom-Dump einspielen
#   docker compose -f /opt/arctos/docker-compose.production.yml exec -T postgres pg_restore -U grc -d grc_daimon --no-owner < /opt/arctos/backups/grc_daimon-YYYYMMDD-HHMMSS.dump
#   # 4. Container starten
#   docker compose -f /opt/arctos/docker-compose.production.yml start web web-daimon
# ============================================================================

set -euo pipefail

BACKUP_DIR="/opt/arctos/backups"
COMPOSE_FILE="/opt/arctos/docker-compose.production.yml"
PG_SERVICE="postgres"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
LABEL="${1:-}"
TARGET_DB=""

case "${LABEL}" in
  ""|--all)       ;;
  --pre-migration) LABEL="pre-migration" ;;
  --*)             LABEL="${LABEL#--}" ;;
  *)               TARGET_DB="$LABEL"; LABEL="" ;;
esac

mkdir -p "$BACKUP_DIR"

echo "============================================="
echo "  ARCTOS — DB Backup"
echo "============================================="
echo "  Timestamp:  $TIMESTAMP"
echo "  Target:     ${TARGET_DB:-<alle Tenant-DBs + grc_platform>}"
echo "  Label:      ${LABEL:-<keins>}"
echo "  Zielpfad:   $BACKUP_DIR"
echo ""

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "FEHLER: $COMPOSE_FILE nicht gefunden."
  exit 1
fi

# ── 1. DB-Liste bestimmen ─────────────────────────────────────────
if [ -n "$TARGET_DB" ]; then
  DB_LIST="$TARGET_DB"
else
  echo "[1/3] DB-Liste ermitteln..."
  DB_LIST=$(
    docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
      psql -U grc -d postgres -tAc \
      "SELECT datname FROM pg_database WHERE datname LIKE 'grc\\_%' ESCAPE '\\\\' OR datname = 'grc_platform' ORDER BY datname;"
  )
  if [ -z "$DB_LIST" ]; then
    echo "FEHLER: Keine Tenant-DBs gefunden (kein Datenbankname mit Präfix 'grc_')."
    exit 1
  fi
  echo "  Gefundene DBs:"
  echo "$DB_LIST" | sed 's/^/    /'
fi

# ── 2. Pro DB: Custom-Dump + Plain-SQL + Checksumme ────────────────
echo ""
echo "[2/3] Dumps erzeugen..."
TOTAL_OK=0
TOTAL_FAIL=0
for DB in $DB_LIST; do
  DB=$(echo "$DB" | xargs) # trim
  [ -z "$DB" ] && continue
  SUFFIX="${LABEL:+-$LABEL}"
  BASE="$BACKUP_DIR/${DB}-${TIMESTAMP}${SUFFIX}"

  echo "  → $DB"

  # Custom-Format (für pg_restore, kleinste Dateigröße, parallelisierbar)
  if docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
       pg_dump -U grc --format=custom --compress=6 --no-owner --no-privileges "$DB" \
       > "${BASE}.dump" 2>/dev/null; then
    DUMP_SIZE=$(du -h "${BASE}.dump" | cut -f1)
    echo "      Custom-Dump:   ${BASE}.dump ($DUMP_SIZE)"

    # Plain-SQL zur Inspektion (gzipped)
    docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
      pg_dump -U grc --format=plain --no-owner --no-privileges "$DB" \
      | gzip -9 > "${BASE}.sql.gz" 2>/dev/null || true
    SQL_SIZE=$(du -h "${BASE}.sql.gz" 2>/dev/null | cut -f1 || echo "?")
    echo "      Plain-SQL:     ${BASE}.sql.gz ($SQL_SIZE)"

    # SHA-256 Checksumme
    sha256sum "${BASE}.dump" > "${BASE}.dump.sha256"

    TOTAL_OK=$((TOTAL_OK + 1))
  else
    echo "      FEHLER beim Dump von $DB — uebersprungen."
    rm -f "${BASE}.dump" "${BASE}.sql.gz" 2>/dev/null
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
done

# ── 3. Rotation: alte Backups nach 30 Tagen loeschen (auf Wunsch) ──
echo ""
echo "[3/3] Alte Backups (> 30 Tage) aufraeumen..."
OLD_COUNT=$(find "$BACKUP_DIR" -type f \( -name "*.dump" -o -name "*.sql.gz" -o -name "*.sha256" \) -mtime +30 2>/dev/null | wc -l)
if [ "$OLD_COUNT" -gt 0 ]; then
  find "$BACKUP_DIR" -type f \( -name "*.dump" -o -name "*.sql.gz" -o -name "*.sha256" \) -mtime +30 -delete
  echo "  $OLD_COUNT alte Dateien geloescht."
else
  echo "  Keine alten Dateien zu loeschen."
fi

# ── Ergebnis ───────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "  Fertig: $TOTAL_OK erfolgreich, $TOTAL_FAIL fehlgeschlagen"
echo "  Speicherort: $BACKUP_DIR"
echo "============================================="

if [ "$TOTAL_FAIL" -gt 0 ]; then
  exit 2
fi
