#!/bin/bash
# ============================================================================
# ARCTOS GRC Platform — Hetzner CX42 Setup Script
# Fuer Ubuntu 24.04 LTS auf Hetzner Cloud (16GB RAM, 8 vCPU)
#
# Ausfuehren als root:
#   curl -sSL https://raw.githubusercontent.com/agatho/grc-platform/main/deploy/setup.sh | bash
# ============================================================================

set -euo pipefail

echo "=== ARCTOS GRC Platform Setup ==="
echo "Server: $(hostname) | $(cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"

# ── 1. System-Updates ──────────────────────────────────────
echo "[1/6] System-Updates..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Docker installieren ─────────────────────────────────
echo "[2/6] Docker installieren..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi
docker --version

# ── 3. Docker Compose (Plugin) ─────────────────────────────
echo "[3/6] Docker Compose pruefen..."
docker compose version

# ── 4. Caddy (Reverse Proxy + Auto-HTTPS) ──────────────────
echo "[4/6] Caddy installieren..."
if ! command -v caddy &> /dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y caddy
fi
caddy version

# ── 5. Projektverzeichnis ──────────────────────────────────
echo "[5/6] Projektverzeichnis einrichten..."
mkdir -p /opt/arctos
cd /opt/arctos

# Klone Repo (falls nicht vorhanden)
if [ ! -d ".git" ]; then
  echo "Repository klonen..."
  git clone https://github.com/agatho/grc-platform.git .
else
  echo "Repository aktualisieren..."
  git pull --rebase
fi

# ── 6. Konfiguration ──────────────────────────────────────
echo "[6/6] Konfiguration..."

if [ ! -f ".env" ]; then
  echo "Erstelle .env aus Template..."
  cp deploy/.env.production .env
  # Generiere sichere Secrets
  sed -i "s|CHANGE_ME_AUTH_SECRET|$(openssl rand -hex 32)|" .env
  sed -i "s|CHANGE_ME_WB_KEY|$(openssl rand -hex 32)|" .env
  sed -i "s|CHANGE_ME_CRON|$(openssl rand -hex 16)|" .env
  sed -i "s|CHANGE_ME_DB_PW|$(openssl rand -base64 24)|" .env
  echo ""
  echo "========================================="
  echo "WICHTIG: Bearbeiten Sie /opt/arctos/.env"
  echo "Setzen Sie mindestens:"
  echo "  DOMAIN=arctos.ihrefirma.de"
  echo "========================================="
else
  echo ".env existiert bereits, ueberspringe..."
fi

echo ""
echo "=== Setup abgeschlossen ==="
echo ""
echo "Naechste Schritte:"
echo "  1. nano /opt/arctos/.env    (Domain + Secrets pruefen)"
echo "  2. nano /opt/arctos/deploy/Caddyfile  (Domain anpassen)"
echo "  3. cd /opt/arctos && docker compose -f docker-compose.production.yml up -d"
echo "  4. caddy start --config /opt/arctos/deploy/Caddyfile"
echo "  5. docker compose -f docker-compose.production.yml exec web npm run db:migrate-all"
echo "  6. docker compose -f docker-compose.production.yml exec web npm run db:seed"
echo ""
echo "Login: admin@arctos.dev / admin123"
