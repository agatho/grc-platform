#!/bin/bash
# ============================================================================
# ARCTOS — Neuen Mandanten (Tenant) erstellen
#
# Erstellt eine separate DB + Web-Instanz + Caddy-Subdomain
# Vollstaendige Datenisolation: eigene DB, eigener Container
#
# Verwendung:
#   sudo bash deploy/create-tenant.sh <tenant-name> <subdomain>
#
# Beispiel:
#   sudo bash deploy/create-tenant.sh daimon daimon.arctos.charliehund.de
#   sudo bash deploy/create-tenant.sh tester1 tester1.arctos.charliehund.de
# ============================================================================

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Verwendung: sudo bash deploy/create-tenant.sh <tenant-name> <subdomain>"
  echo "Beispiel:   sudo bash deploy/create-tenant.sh daimon daimon.arctos.charliehund.de"
  exit 1
fi

TENANT="$1"
SUBDOMAIN="$2"
COMPOSE_FILE="/opt/arctos/docker-compose.production.yml"
TENANT_DIR="/opt/arctos/tenants/$TENANT"
DB_NAME="grc_${TENANT}"
DB_PW=$(openssl rand -base64 24 | tr -d '=/+' | head -c 24)
AUTH_SECRET=$(openssl rand -hex 32)
WB_KEY=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 16)

# Naechsten freien Port finden (ab 3010)
EXISTING_PORTS=$(grep -rh 'PORT=' /opt/arctos/tenants/*/env 2>/dev/null | grep -o '[0-9]*' | sort -n)
NEXT_PORT=3010
for p in $EXISTING_PORTS; do
  if [ "$p" -ge "$NEXT_PORT" ]; then
    NEXT_PORT=$((p + 1))
  fi
done

echo "============================================="
echo "  ARCTOS — Neuer Mandant: $TENANT"
echo "============================================="
echo "  Subdomain:  $SUBDOMAIN"
echo "  Datenbank:  $DB_NAME"
echo "  Port:       $NEXT_PORT"
echo ""

# ── 1. Tenant-Verzeichnis ─────────────────────────────────
echo "[1/5] Tenant-Verzeichnis erstellen..."
mkdir -p "$TENANT_DIR"

# ── 2. Datenbank erstellen ────────────────────────────────
echo "[2/5] Datenbank $DB_NAME erstellen..."
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d postgres -c "
  SELECT 'exists' FROM pg_database WHERE datname = '$DB_NAME';
" | grep -q exists && echo "  DB existiert bereits" || {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d postgres -c "CREATE DATABASE $DB_NAME OWNER grc;"
  echo "  DB erstellt"
}

# Extensions
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d "$DB_NAME" -c "
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
" 2>/dev/null

# Schema kopieren (Struktur ohne Daten)
echo "  Schema kopieren..."
docker compose -f "$COMPOSE_FILE" exec -T postgres bash -c "pg_dump -U grc -d grc_platform --schema-only 2>/dev/null | psql -U grc -d $DB_NAME 2>/dev/null" || true

# Migrationen ausfuehren
echo "  Migrationen ausfuehren..."
for f in $(docker compose -f "$COMPOSE_FILE" exec -T web ls /app/packages/db/drizzle/ 2>/dev/null | grep "^0" | sort); do
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d "$DB_NAME" -f "/dev/stdin" < "/opt/arctos/packages/db/drizzle/$f" 2>/dev/null || true
done

# Platform-Seed
echo "  Platform-Seed..."
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d "$DB_NAME" -f "/dev/stdin" < /opt/arctos/packages/db/sql/seed_demo_00_platform.sql 2>/dev/null || true

echo "  Datenbank bereit"

# ── 3. Tenant .env erstellen ──────────────────────────────
echo "[3/5] Tenant-Konfiguration..."

cat > "$TENANT_DIR/env" << TENVEOF
# Tenant: $TENANT
# Erstellt: $(date -u +"%Y-%m-%d %H:%M UTC")
TENANT_NAME=$TENANT
DOMAIN=$SUBDOMAIN
PORT=$NEXT_PORT
DATABASE_URL=postgresql://grc:grc_dev_password@postgres:5432/$DB_NAME
AUTH_SECRET=$AUTH_SECRET
AUTH_URL=https://$SUBDOMAIN
AUTH_TRUST_HOST=true
WB_ENCRYPTION_KEY=$WB_KEY
CRON_SECRET=$CRON_SECRET
NODE_ENV=production
REDIS_URL=redis://redis:6379
RUN_SEEDS=false
EMAIL_ENABLED=false
TENVEOF

echo "  Config gespeichert: $TENANT_DIR/env"

# ── 4. Docker-Compose fuer Tenant ─────────────────────────
echo "[4/5] Container starten..."

cat > "$TENANT_DIR/docker-compose.yml" << DCEOF
services:
  web-$TENANT:
    image: ghcr.io/arctos/grc-web:latest
    build:
      context: /opt/arctos
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:$NEXT_PORT:3000"
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    env_file:
      - env
    networks:
      - arctos_arctos

networks:
  arctos_arctos:
    external: true
DCEOF

cd "$TENANT_DIR"
docker compose up -d --build 2>&1 | tail -5

echo "  Container web-$TENANT auf Port $NEXT_PORT gestartet"

# ── 5. Caddy Subdomain hinzufuegen ───────────────────────
echo "[5/5] Caddy-Routing fuer $SUBDOMAIN..."

# Pruefe ob Subdomain schon in Caddyfile
if grep -q "$SUBDOMAIN" /etc/caddy/Caddyfile 2>/dev/null; then
  echo "  Subdomain bereits konfiguriert"
else
  # Vor dem Catch-All-Block einfuegen (oder am Ende)
  cat >> /etc/caddy/Caddyfile << CADDYEOF

# Tenant: $TENANT
$SUBDOMAIN {
  @trace method TRACE TRACK
  respond @trace 405

  reverse_proxy localhost:$NEXT_PORT

  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "SAMEORIGIN"
    Referrer-Policy "strict-origin-when-cross-origin"
    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'"
    Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
    -Server
    -X-Powered-By
  }

  encode gzip zstd

  log {
    output file /var/log/caddy/arctos-$TENANT.log {
      roll_size 10mb
      roll_keep 5
    }
    format json
  }
}
CADDYEOF

  systemctl reload caddy
  echo "  Caddy-Routing aktiviert"
fi

echo ""
echo "============================================="
echo "  Mandant '$TENANT' erstellt!"
echo "============================================="
echo ""
echo "  URL:       https://$SUBDOMAIN"
echo "  Login:     admin@arctos.dev / admin123"
echo "  Datenbank: $DB_NAME (isoliert)"
echo "  Port:      $NEXT_PORT (intern)"
echo "  Config:    $TENANT_DIR/env"
echo ""
echo "  Verwaltung:"
echo "    Logs:    cd $TENANT_DIR && docker compose logs -f"
echo "    Stop:    cd $TENANT_DIR && docker compose down"
echo "    Start:   cd $TENANT_DIR && docker compose up -d"
echo "    Loeschen: sudo bash deploy/delete-tenant.sh $TENANT"
echo ""
