#!/usr/bin/env bash
# Server-Ist-Zustands-Report für Release-0.1-Alpha-Triage.
# In der offenen arctos@-SSH-Session ausführen:
#   curl -fsSL <this file> | bash
# oder (nach rsync/scp):
#   bash server-diag.sh
#
# Erzeugt einen kompakten Bericht auf stdout. Keine Schreibzugriffe.

set -uo pipefail

section() {
  echo
  echo "──────────────────────────────────────────────"
  echo "▶  $1"
  echo "──────────────────────────────────────────────"
}

section "Host"
uname -a
echo "uptime: $(uptime)"
echo "distro: $(. /etc/os-release && echo "$PRETTY_NAME")"
echo "disk (/):"
df -h / | tail -1
echo "mem:"
free -h | head -2

section "Docker"
if command -v docker >/dev/null; then
  docker --version
  docker compose version 2>/dev/null || docker-compose --version
  echo
  echo "docker compose ps (in /opt/arctos):"
  (cd /opt/arctos 2>/dev/null && docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Image}}") || echo "  (no /opt/arctos or compose not initialised)"
  echo
  echo "docker images (arctos/grc):"
  docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}" | grep -iE "arctos|grc-" | head -10 || true
else
  echo "docker not installed"
fi

section "ARCTOS /opt/arctos layout"
if [ -d /opt/arctos ]; then
  ls -la /opt/arctos/
  echo
  echo ".env presence (values redacted):"
  if [ -f /opt/arctos/.env ]; then
    sed -E 's/=(.*)/=<redacted>/' /opt/arctos/.env | head -40
  else
    echo "  NO /opt/arctos/.env"
  fi
else
  echo "/opt/arctos missing"
fi

section "Postgres"
if docker ps --format '{{.Names}}' | grep -q postgres; then
  CONT=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
  echo "container: $CONT"
  docker exec "$CONT" psql -U grc -d grc_platform -tAc "SELECT version();" 2>/dev/null | head -1 || echo "  (psql inside container failed)"
  echo
  echo "extensions:"
  docker exec "$CONT" psql -U grc -d grc_platform -tAc "SELECT extname FROM pg_extension ORDER BY extname;" 2>/dev/null | tr '\n' ', '
  echo
  echo
  echo "table count:"
  docker exec "$CONT" psql -U grc -d grc_platform -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null
  echo
  echo "audit_log row count (last 7 days):"
  docker exec "$CONT" psql -U grc -d grc_platform -tAc "SELECT count(*) FROM audit_log WHERE created_at > now() - interval '7 days';" 2>/dev/null
  echo
  echo "append-only rules:"
  docker exec "$CONT" psql -U grc -d grc_platform -tAc "SELECT tablename || '.' || rulename FROM pg_rules WHERE schemaname='public' AND rulename LIKE '%_no_%' ORDER BY tablename, rulename;" 2>/dev/null
  echo
  echo "tombstone guard trigger:"
  docker exec "$CONT" psql -U grc -d grc_platform -tAc "SELECT tgname FROM pg_trigger WHERE tgname = 'audit_log_tombstone_guard' AND NOT tgisinternal;" 2>/dev/null
  echo
  echo "RLS audit (tables missing RLS):"
  docker exec "$CONT" psql -U grc -d grc_platform -tAc "
    SELECT string_agg(c.relname, ', ')
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relrowsecurity = false
      AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = c.relname
                    AND column_name = 'org_id')
      AND c.relname NOT IN ('organization');
  " 2>/dev/null
else
  echo "no postgres container running"
fi

section "Web container"
if docker ps --format '{{.Names}}' | grep -q -E "web|arctos"; then
  WEB=$(docker ps --format '{{.Names}}' | grep -E "web|arctos" | head -1)
  echo "container: $WEB"
  echo "image: $(docker inspect --format='{{.Config.Image}}' "$WEB")"
  echo
  echo "last 20 log lines:"
  docker logs --tail 20 "$WEB" 2>&1
  echo
  echo "/login HTTP probe (internal):"
  docker exec "$WEB" wget -qO- --server-response http://localhost:3000/login 2>&1 | head -5 || true
else
  echo "no web container running"
fi

section "Backups"
ls -la /opt/arctos/backups/ 2>/dev/null | head -20 || echo "no /opt/arctos/backups/"

section "Cron"
crontab -l 2>/dev/null | grep -v '^#' | grep . || echo "no user crontab"
ls /etc/cron.d/ 2>/dev/null | head -10

section "Networking"
echo "caddy reachable:"
curl -sSfI -o /dev/null -w "%{http_code}\n" http://localhost 2>&1 || true
ss -tlnp 2>/dev/null | awk 'NR==1 || /:(80|443|3000|5432|6379|3001)\s/'

echo
echo "──────────────────────────────────────────────"
echo "DIAG COMPLETE — paste back into chat"
echo "──────────────────────────────────────────────"
