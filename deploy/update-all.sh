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

# ── 2. Docker Images neu bauen (web + worker) ─────────────
# Worker MUSS mit gebaut werden, sonst läuft die Cron-Engine noch mit
# einem alten Image — typischer Crash-Loop wäre "Cannot find module ..."
# nach Schema- oder Dep-Änderungen. Beide Images nutzen denselben
# Layer-Cache; Worker-Build dauert ~30 s wenn nur Source geändert.
echo ""
echo "[2/5] Docker Images neu bauen (web + worker)..."
docker compose -f "$COMPOSE_FILE" build web worker 2>&1 | tail -15

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

# ── 3b. Katalog-Baseline-Top-up (idempotent) ──────────────
# Alle Kataloge sind scope='platform'. Ältere Tenants (vor Einführung
# des Katalog-Seeders in create-tenant.sh) haben keine Frameworks.
# Die Seeds sind via ON CONFLICT DO NOTHING idempotent → einfach neu
# einspielen, bereits vorhandene Rows werden übersprungen.
echo ""
echo "[3b/5] Katalog-Baseline top-up (idempotent, alle DBs)..."
SEEDER=/opt/arctos/deploy/seed-catalogs.sh
if [ -f "$SEEDER" ]; then
  chmod +x "$SEEDER" 2>/dev/null || true
  echo "  → grc_platform"
  bash "$SEEDER" grc_platform 2>&1 | sed 's/^/    /' || true
  if [ -d /opt/arctos/tenants ]; then
    for tdir in /opt/arctos/tenants/*/; do
      [ -d "$tdir" ] || continue
      TENANT=$(basename "$tdir")
      echo "  → grc_${TENANT}"
      bash "$SEEDER" "grc_${TENANT}" 2>&1 | sed "s/^/    /" || true
    done
  fi
else
  echo "  FEHLER: $SEEDER fehlt — Tenants bleiben ohne Frameworks!"
fi

# ── 4. Haupt-Container neu starten (web + worker) ─────────
echo ""
echo "[4/5] Haupt-Container neu starten (web + worker)..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate web worker 2>&1 | tail -5

# Worker-Health quick-check: zeigt sofort ob die Cron-Engine startet
# oder im Crash-Loop steckt (Symptom für fehlende Module / Schema-Drift).
sleep 5
WORKER_STATE=$(docker compose -f "$COMPOSE_FILE" ps --format json worker 2>/dev/null | grep -oP '"State":"\K[^"]+' | head -1)
if [ "$WORKER_STATE" != "running" ]; then
  echo "  WARNUNG: Worker-Container nicht im Status 'running' (aktuell: ${WORKER_STATE:-unknown})."
  echo "  Letzte Worker-Logs:"
  docker compose -f "$COMPOSE_FILE" logs --tail=20 worker 2>&1 | sed 's/^/    /'
fi

# ── 4b. Tenant-Worker-Service sicherstellen (Backfill) ────
# Ältere Tenants wurden vor Einführung der per-Tenant-Worker-Architektur
# angelegt und haben in ihrer docker-compose.yml nur web-<name>. Das
# bedeutet: keine Cron-Verarbeitung pro Tenant (Programme-Deadlines, SoA-
# Sync, NIS2-Mahnungen etc. fallen aus). Der Helper ist idempotent —
# regeneriert die docker-compose.yml mit web + worker, preserved den
# bestehenden Host-Port. Backup wird einmalig als .pre-worker-backup
# abgelegt.
echo ""
echo "[4b/5] Tenant-Worker-Service sicherstellen (idempotent)..."
HELPER=/opt/arctos/deploy/ensure-tenant-worker.sh
if [ -f "$HELPER" ]; then
  chmod +x "$HELPER" 2>/dev/null || true
  bash "$HELPER" 2>&1 | sed 's/^/  /' || true
else
  echo "  WARNUNG: $HELPER fehlt — bestehende Tenants bekommen keinen Worker"
fi

# ── 5. Alle Tenant-Container neu starten ─────────────────
echo ""
echo "[5/5] Tenant-Container neu starten (web + worker)..."
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    TENANT=$(basename "$tdir")
    echo "  Tenant: $TENANT"
    cd "$tdir"
    docker compose up -d --force-recreate --build 2>&1 | tail -3

    # Worker-Health-Check pro Tenant: zeigt sofort ob die Cron-Engine für
    # diesen Tenant läuft oder im Crash-Loop steckt.
    sleep 3
    WORKER_STATE=$(docker compose ps --format json "worker-$TENANT" 2>/dev/null | grep -oP '"State":"\K[^"]+' | head -1)
    if [ -n "$WORKER_STATE" ] && [ "$WORKER_STATE" != "running" ]; then
      echo "    WARNUNG: worker-$TENANT nicht 'running' (aktuell: $WORKER_STATE)"
      docker compose logs --tail=15 "worker-$TENANT" 2>&1 | sed 's/^/      /'
    fi
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
