#!/bin/bash
# ============================================================================
# ARCTOS — Update aller Container (Main + alle Tenants)
#
# Was dieses Script macht:
# 1. git pull im Haupt-Repo
# 2. Docker Image neu bauen
# 3. Migrationen auf alle Datenbanken anwenden
# 4. Haupt-Container neu starten
# 5. Alle Tenant-Container neu starten
#
# Verwendung: sudo bash /opt/arctos/deploy/update-all.sh
# ============================================================================

set -euo pipefail

cd /opt/arctos
COMPOSE_FILE="/opt/arctos/docker-compose.production.yml"

echo "============================================="
echo "  ARCTOS — Update aller Instanzen"
echo "  $(date -u +"%Y-%m-%d %H:%M UTC")"
echo "============================================="
echo ""

# ── 1. Code aktualisieren ─────────────────────────────────
echo "[1/5] Code aktualisieren..."
OLD_COMMIT=$(git rev-parse HEAD)
git pull origin main
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  echo "  Kein Update verfuegbar ($OLD_COMMIT)"
else
  echo "  $OLD_COMMIT → $NEW_COMMIT"
fi

# ── 2. Docker Image neu bauen ─────────────────────────────
echo ""
echo "[2/5] Docker Image neu bauen..."
docker compose -f "$COMPOSE_FILE" build web 2>&1 | tail -10

# ── 3. Migrationen auf alle DBs ──────────────────────────
echo ""
echo "[3/5] Migrationen anwenden..."

# Main DB
echo "  DB: grc_platform (main)"
for f in $(ls /opt/arctos/packages/db/drizzle/0*.sql 2>/dev/null | sort); do
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d grc_platform -f "/dev/stdin" < "$f" >/dev/null 2>&1 || true
done

# Tenant DBs
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    TENANT=$(basename "$tdir")
    DB_NAME="grc_${TENANT}"
    echo "  DB: $DB_NAME (tenant: $TENANT)"
    for f in $(ls /opt/arctos/packages/db/drizzle/0*.sql 2>/dev/null | sort); do
      docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d "$DB_NAME" -f "/dev/stdin" < "$f" >/dev/null 2>&1 || true
    done
  done
fi

# ── 4. Haupt-Container neu starten ────────────────────────
echo ""
echo "[4/5] Haupt-Container neu starten..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate web 2>&1 | tail -3

# ── 5. Alle Tenant-Container neu starten ─────────────────
echo ""
echo "[5/5] Tenant-Container neu starten..."
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    TENANT=$(basename "$tdir")
    echo "  Tenant: $TENANT"
    cd "$tdir"
    docker compose up -d --force-recreate --build 2>&1 | tail -3
    cd /opt/arctos
  done
fi

# ── Health-Checks ─────────────────────────────────────────
echo ""
echo "Health-Checks..."
sleep 10

# Main
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/login 2>/dev/null)
printf "  %-40s HTTP %s\n" "main (127.0.0.1:3000)" "$CODE"

# Tenants
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    TENANT=$(basename "$tdir")
    PORT=$(cd "$tdir" && docker compose ps --format json 2>/dev/null | grep -oP '"Publishers":\[\{[^}]*"PublishedPort":\K[0-9]+' | head -1)
    if [ -n "$PORT" ]; then
      CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:$PORT/login" 2>/dev/null)
      printf "  %-40s HTTP %s\n" "$TENANT (127.0.0.1:$PORT)" "$CODE"
    fi
  done
fi

echo ""
echo "============================================="
echo "  Update abgeschlossen: $NEW_COMMIT"
echo "============================================="
