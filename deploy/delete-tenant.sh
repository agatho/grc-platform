#!/bin/bash
# ============================================================================
# ARCTOS — Mandant (Tenant) loeschen
# Entfernt Container, Datenbank und Caddy-Config
#
# Verwendung: sudo bash deploy/delete-tenant.sh <tenant-name>
# ============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Verwendung: sudo bash deploy/delete-tenant.sh <tenant-name>"
  exit 1
fi

TENANT="$1"
TENANT_DIR="/opt/arctos/tenants/$TENANT"
DB_NAME="grc_${TENANT}"
COMPOSE_FILE="/opt/arctos/docker-compose.production.yml"

if [ ! -d "$TENANT_DIR" ]; then
  echo "FEHLER: Tenant '$TENANT' nicht gefunden in $TENANT_DIR"
  exit 1
fi

read -rp "Mandant '$TENANT' wirklich loeschen? DB + Container + Config werden entfernt. (ja/nein): " CONFIRM
if [ "$CONFIRM" != "ja" ]; then
  echo "Abgebrochen."
  exit 0
fi

echo "Loesche Mandant: $TENANT"

# 1. Container stoppen
echo "[1/4] Container stoppen..."
cd "$TENANT_DIR" && docker compose down 2>/dev/null || true

# 2. Datenbank loeschen
echo "[2/4] Datenbank $DB_NAME loeschen..."
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true

# 3. Caddy-Config entfernen
echo "[3/4] Caddy-Config bereinigen..."
SUBDOMAIN=$(grep "^DOMAIN=" "$TENANT_DIR/env" 2>/dev/null | cut -d= -f2)
if [ -n "$SUBDOMAIN" ]; then
  # Entferne den Tenant-Block aus Caddyfile
  sed -i "/# Tenant: $TENANT/,/^}/d" /etc/caddy/Caddyfile
  systemctl reload caddy 2>/dev/null || true
fi

# 4. Verzeichnis loeschen
echo "[4/4] Tenant-Verzeichnis loeschen..."
rm -rf "$TENANT_DIR"

echo ""
echo "Mandant '$TENANT' vollstaendig geloescht."
