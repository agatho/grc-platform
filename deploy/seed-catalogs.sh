#!/bin/bash
# ============================================================================
# ARCTOS — Platform-Baseline-Kataloge auf eine Tenant-DB ausrollen
#
# Seedet alle 46 Katalog-Frameworks (ISO 27002, NIS2, DORA, BSI, NIST CSF,
# GDPR, ESRS, AI Act, …) plus die Cross-Framework-Mappings in eine einzelne
# Datenbank. Alle Seeds sind idempotent (ON CONFLICT DO NOTHING oder via
# insert_mapping()-Helper), deshalb ist das Skript beliebig oft re-runnable.
#
# Hintergrund: Katalog-Daten sind scope='platform' (kein org_id) und damit
# echte Baseline-Daten — jeder Tenant muss sie haben, sonst sind Module wie
# ISMS, ERM, ICS, DPMS, BCMS ohne vorgefertigte Frameworks leer.
#
# Verwendung:
#   sudo bash deploy/seed-catalogs.sh <DB_NAME>
#   sudo bash deploy/seed-catalogs.sh grc_daimon
#   sudo bash deploy/seed-catalogs.sh grc_platform
#
# Umgebung:
#   COMPOSE_FILE : /opt/arctos/docker-compose.production.yml (Default)
#   SQL_DIR      : /opt/arctos/packages/db/sql (Default)
# ============================================================================

set -uo pipefail

DB_NAME="${1:-}"
if [ -z "$DB_NAME" ]; then
  echo "Verwendung: sudo bash deploy/seed-catalogs.sh <DB_NAME>"
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-/opt/arctos/docker-compose.production.yml}"
SQL_DIR="${SQL_DIR:-/opt/arctos/packages/db/sql}"

if [ ! -d "$SQL_DIR" ]; then
  echo "FEHLER: Seed-Verzeichnis $SQL_DIR nicht gefunden."
  exit 2
fi

run_sql() {
  local file="$1"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U grc -d "$DB_NAME" -v ON_ERROR_STOP=0 -q -f /dev/stdin \
    < "$file" 2>&1 | grep -vE '^(INSERT|UPDATE|SET|BEGIN|COMMIT|NOTICE|CREATE|DROP|ALTER|DO|SELECT|--)$' \
    | grep -vE '^$' || true
}

echo "── Platform-Baseline-Kataloge → $DB_NAME ──"

# Reihenfolge: erst die Helper-Funktion aus v1 definieren, dann die Kataloge
# seeden, dann die Mappings (v1 → v5) — die v2/v3/v4/v5-Dateien rufen
# insert_mapping() auf, das in v1 definiert wird.

echo "[1/3] insert_mapping()-Helper (Cross-Framework v1 Kopfteil)..."
# seed_cross_framework_mappings.sql enthält CREATE OR REPLACE FUNCTION + Daten.
# Wir führen es vollständig aus — CREATE OR REPLACE ist safe, Daten haben ON CONFLICT.
if [ -f "$SQL_DIR/seed_cross_framework_mappings.sql" ]; then
  run_sql "$SQL_DIR/seed_cross_framework_mappings.sql"
  echo "  ✓ seed_cross_framework_mappings.sql (v1 + Helper)"
fi

echo "[2/3] Katalog-Frameworks (46 Dateien)..."
count=0
for f in "$SQL_DIR"/seed_catalog_*.sql; do
  [ -f "$f" ] || continue
  run_sql "$f"
  count=$((count + 1))
  printf "  ✓ %s\n" "$(basename "$f")"
done
echo "  ($count Katalog-Seeds angewendet)"

echo "[3/3] Cross-Framework-Mappings v2–v5..."
for v in v2 v3 v4 v5; do
  f="$SQL_DIR/seed_cross_framework_mappings_${v}.sql"
  [ -f "$f" ] || continue
  run_sql "$f"
  echo "  ✓ seed_cross_framework_mappings_${v}.sql"
done

# ── Bilanz ─────────────────────────────────────────────────────────────
echo ""
echo "── Bilanz: $DB_NAME ──"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U grc -d "$DB_NAME" -qAtc "
    SELECT 'catalogs       : ' || count(*) FROM catalog
    UNION ALL SELECT 'catalog_entries: ' || count(*) FROM catalog_entry
    UNION ALL SELECT 'mappings       : ' || count(*) FROM catalog_entry_mapping
  " 2>/dev/null | sed 's/^/  /'

echo ""
echo "Katalog-Seed abgeschlossen für $DB_NAME."
