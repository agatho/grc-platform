#!/bin/bash
# ARCTOS — Alle Mandanten auflisten
echo "============================================="
echo "  ARCTOS Mandanten"
echo "============================================="
echo ""
printf "%-15s %-40s %-8s %-10s\n" "TENANT" "SUBDOMAIN" "PORT" "STATUS"
printf "%-15s %-40s %-8s %-10s\n" "------" "---------" "----" "------"

# Haupt-Instanz
printf "%-15s %-40s %-8s %-10s\n" "(main)" "arctos.charliehund.de" "3000" "running"

# Tenant-Instanzen
for dir in /opt/arctos/tenants/*/; do
  [ -d "$dir" ] || continue
  TENANT=$(basename "$dir")
  SUBDOMAIN=$(grep "^DOMAIN=" "$dir/env" 2>/dev/null | cut -d= -f2 || echo "?")
  PORT=$(grep "^PORT=" "$dir/env" 2>/dev/null | cut -d= -f2 || echo "?")
  STATUS=$(cd "$dir" && docker compose ps --format "{{.State}}" 2>/dev/null | head -1 || echo "stopped")
  printf "%-15s %-40s %-8s %-10s\n" "$TENANT" "$SUBDOMAIN" "$PORT" "$STATUS"
done
echo ""
