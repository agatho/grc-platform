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
#   VERBOSE=1    : zeigt jede psql-Ausgabe statt sie zu filtern
# ============================================================================

set -uo pipefail

DB_NAME="${1:-}"
if [ -z "$DB_NAME" ]; then
  echo "Verwendung: sudo bash deploy/seed-catalogs.sh <DB_NAME>"
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-/opt/arctos/docker-compose.production.yml}"
SQL_DIR="${SQL_DIR:-/opt/arctos/packages/db/sql}"
VERBOSE="${VERBOSE:-0}"

if [ ! -f "$COMPOSE_FILE" ]; then
  # Fallback: versuch docker-compose.yml ohne .production
  ALT="/opt/arctos/docker-compose.yml"
  if [ -f "$ALT" ]; then
    COMPOSE_FILE="$ALT"
  else
    echo "FEHLER: Compose-Datei $COMPOSE_FILE nicht gefunden."
    exit 2
  fi
fi

if [ ! -d "$SQL_DIR" ]; then
  echo "FEHLER: Seed-Verzeichnis $SQL_DIR nicht gefunden."
  exit 2
fi

# Precheck: existiert die DB überhaupt?
if ! docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -U grc -d postgres -qAtc \
      "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null | grep -q 1; then
  echo "FEHLER: Datenbank '$DB_NAME' existiert nicht."
  exit 3
fi

# Precheck: existiert die catalog-Tabelle? (Migration 0064/0069 muss gelaufen sein)
if ! docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -U grc -d "$DB_NAME" -qAtc \
      "SELECT to_regclass('public.catalog')" 2>/dev/null | grep -q catalog; then
  echo "FEHLER: Tabelle 'catalog' existiert nicht in $DB_NAME."
  echo "        Zuerst Migrationen anwenden:"
  echo "        for f in /opt/arctos/packages/db/drizzle/0*.sql; do"
  echo "          docker compose -f $COMPOSE_FILE exec -T postgres \\"
  echo "            psql -U grc -d $DB_NAME -f /dev/stdin < \"\$f\""
  echo "        done"
  exit 4
fi

pre_counts() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U grc -d "$DB_NAME" -qAtc "
      SELECT
        (SELECT count(*) FROM catalog) || '|' ||
        (SELECT count(*) FROM catalog_entry) || '|' ||
        (SELECT count(*) FROM catalog_entry_mapping)
    " 2>/dev/null | tr -d '\r'
}

run_sql() {
  local file="$1"
  local label="$2"
  local output
  # ON_ERROR_STOP=0 damit einzelne Row-Kollisionen nicht ganze Datei killen,
  # aber wir geben stderr roh aus damit Fehler sichtbar bleiben.
  output=$(
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -U grc -d "$DB_NAME" -v ON_ERROR_STOP=0 -q \
      -f /dev/stdin < "$file" 2>&1
  )
  local rc=$?
  if [ "$VERBOSE" = "1" ]; then
    printf '%s\n' "$output" | sed 's/^/      /'
  else
    # Zeige nur ERROR/FATAL/WARNING-Zeilen (psql prepends diese)
    local errs
    errs=$(printf '%s\n' "$output" | grep -E '^(ERROR|FATAL|WARNING):' || true)
    if [ -n "$errs" ]; then
      printf '%s\n' "$errs" | head -5 | sed 's/^/      /'
    fi
  fi
  return $rc
}

echo "── Platform-Baseline-Kataloge → $DB_NAME ──"
echo "  compose: $COMPOSE_FILE"
echo "  sql-dir: $SQL_DIR"

BEFORE=$(pre_counts)
IFS='|' read -r B_CAT B_ENT B_MAP <<< "${BEFORE:-0|0|0}"
echo "  vor Seed  → catalogs=$B_CAT entries=$B_ENT mappings=$B_MAP"
echo ""

# Reihenfolge: erst die Helper-Funktion aus v1 definieren, dann die Kataloge
# seeden, dann die Mappings (v1 → v5) — die v2/v3/v4/v5-Dateien rufen
# insert_mapping() auf, das in v1 definiert wird.

echo "[1/3] insert_mapping()-Helper (Cross-Framework v1 Kopfteil)..."
if [ -f "$SQL_DIR/seed_cross_framework_mappings.sql" ]; then
  run_sql "$SQL_DIR/seed_cross_framework_mappings.sql" "v1"
  echo "  ✓ seed_cross_framework_mappings.sql (v1 + Helper)"
else
  echo "  (Datei fehlt — übersprungen)"
fi

echo ""
echo "[2/3] Katalog-Frameworks..."
count=0
failed=0
for f in "$SQL_DIR"/seed_catalog_*.sql; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  if run_sql "$f" "$name"; then
    count=$((count + 1))
    printf "  ✓ %s\n" "$name"
  else
    failed=$((failed + 1))
    printf "  ✗ %s (exit != 0)\n" "$name"
  fi
done
echo "  → $count Seeds angewendet, $failed fehlgeschlagen"

echo ""
echo "[3/3] Cross-Framework-Mappings v2–v5..."
for v in v2 v3 v4 v5; do
  f="$SQL_DIR/seed_cross_framework_mappings_${v}.sql"
  if [ -f "$f" ]; then
    run_sql "$f" "$v"
    echo "  ✓ seed_cross_framework_mappings_${v}.sql"
  fi
done

# ── Bilanz ─────────────────────────────────────────────────────────────
echo ""
echo "── Bilanz: $DB_NAME ──"
AFTER=$(pre_counts)
IFS='|' read -r A_CAT A_ENT A_MAP <<< "${AFTER:-0|0|0}"
printf "  catalogs        : %6s  (Δ +%s)\n" "$A_CAT" "$((A_CAT - B_CAT))"
printf "  catalog_entries : %6s  (Δ +%s)\n" "$A_ENT" "$((A_ENT - B_ENT))"
printf "  mappings        : %6s  (Δ +%s)\n" "$A_MAP" "$((A_MAP - B_MAP))"

echo ""
if [ "$A_CAT" -eq 0 ]; then
  echo "⚠  catalog-Tabelle leer — Seeds haben nichts geschrieben."
  echo "   Re-run mit VERBOSE=1 für psql-Ausgabe:"
  echo "   sudo VERBOSE=1 bash $0 $DB_NAME"
  exit 5
fi

echo "✓ Katalog-Seed abgeschlossen für $DB_NAME."
