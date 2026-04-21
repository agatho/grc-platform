#!/bin/bash
# ============================================================================
# ARCTOS GRC Platform — Hetzner CX42 Setup
# Server: 178.104.186.121 | Domain: arctos.charliehund.de
#
# Ausfuehren als root auf dem Server:
#   bash setup-hetzner.sh
# ============================================================================

set -euo pipefail

REPO="https://github.com/agatho/grc-platform.git"

# Domain: erster Parameter oder aus .env oder interaktiv abfragen
if [ -n "${1:-}" ]; then
  DOMAIN="$1"
elif [ -f /opt/arctos/.env ] && grep -q "^DOMAIN=" /opt/arctos/.env; then
  DOMAIN=$(grep "^DOMAIN=" /opt/arctos/.env | cut -d= -f2)
else
  read -rp "Domain fuer ARCTOS (z.B. arctos.firma.de): " DOMAIN
  if [ -z "$DOMAIN" ]; then
    echo "FEHLER: Domain ist erforderlich"
    exit 1
  fi
fi

echo "=== ARCTOS GRC Platform Setup ==="
echo "Server: $(hostname) | Domain: $DOMAIN"
echo ""

# ── 1. System-Updates ──────────────────────────────────────
echo "[1/8] System-Updates..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Docker installieren ─────────────────────────────────
echo "[2/8] Docker installieren..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi
echo "  Docker $(docker --version | cut -d' ' -f3)"

# ── 3. Caddy (Reverse Proxy + Auto-HTTPS) ──────────────────
echo "[3/8] Caddy installieren..."
if ! command -v caddy &> /dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt-get update -qq && apt-get install -y -qq caddy
fi
echo "  Caddy $(caddy version | head -1)"

# ── 4. Git + Node (fuer Seeds) ─────────────────────────────
echo "[4/8] Tools installieren..."
apt-get install -y -qq git

# ── 5. Repository klonen ───────────────────────────────────
echo "[5/8] Repository klonen..."
mkdir -p /opt/arctos
cd /opt/arctos
if [ ! -d ".git" ]; then
  git clone "$REPO" .
else
  git pull --rebase origin main
fi

# ── 6. .env generieren ─────────────────────────────────────
echo "[6/8] Konfiguration generieren..."
if [ ! -f ".env" ]; then
  AUTH_SECRET=$(openssl rand -hex 32)
  WB_KEY=$(openssl rand -hex 32)
  CRON_SECRET=$(openssl rand -hex 16)
  DB_PW=$(openssl rand -base64 24 | tr -d '=/+' | head -c 24)

  cat > .env << ENVEOF
# ARCTOS GRC Platform — Production
# Generiert am $(date -u +"%Y-%m-%d %H:%M UTC")

DOMAIN=$DOMAIN
AUTH_URL=https://$DOMAIN
AUTH_SECRET=$AUTH_SECRET
AUTH_TRUST_HOST=true

DB_PASSWORD=$DB_PW
DATABASE_URL=postgresql://grc:$DB_PW@postgres:5432/grc_platform

WB_ENCRYPTION_KEY=$WB_KEY
CRON_SECRET=$CRON_SECRET

NODE_ENV=production
PORT=3000
REDIS_URL=redis://redis:6379

RUN_SEEDS=true
EMAIL_ENABLED=false

# Optional:
# RESEND_API_KEY=re_xxxxxxxxxxxxx
# ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
ENVEOF

  echo "  .env generiert mit sicheren Secrets"
else
  echo "  .env existiert bereits"
fi

# ── 7. Caddyfile schreiben ─────────────────────────────────
echo "[7/8] Caddyfile konfigurieren..."
mkdir -p /var/log/caddy

# Generate Caddyfile from template with actual domain
sed "s/__DOMAIN__/$DOMAIN/g" /opt/arctos/deploy/Caddyfile > /etc/caddy/Caddyfile

systemctl enable caddy
systemctl restart caddy
echo "  Caddy konfiguriert fuer $DOMAIN"

# ── 8. Docker Compose starten ──────────────────────────────
echo "[8/8] ARCTOS starten..."
cd /opt/arctos
docker compose -f docker-compose.production.yml up -d --build

echo ""
echo "============================================="
echo "  ARCTOS GRC Platform — Setup abgeschlossen"
echo "============================================="
echo ""
echo "  URL:   https://$DOMAIN"
echo "  Login: admin@arctos.dev / admin123"
echo ""
echo "  Test-Logins:"
echo "    ciso@arctos.dev       (CISO)"
echo "    compliance@arctos.dev (Compliance Officer)"
echo "    bcm@arctos.dev        (BCM-Manager)"
echo "    contracts@arctos.dev  (Vertragsmanager)"
echo "    qm@arctos.dev         (Qualitaetsmanager)"
echo "    security@arctos.dev   (Security Analyst)"
echo "    (alle PW: admin123)"
echo ""
echo "  Logs:  docker compose -f docker-compose.production.yml logs -f web"
echo "  Stop:  docker compose -f docker-compose.production.yml down"
echo ""
