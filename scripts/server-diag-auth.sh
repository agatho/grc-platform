#!/usr/bin/env bash
# Login-Fehler auf daimon.arctos.charliehund.de diagnostizieren.
# Zeigt: welche DB, welche Users existieren, wann Passwort-Hash gesetzt.
# Mutiert nichts.
#
# Auf dem Server ausführen:
#   curl -fsSL https://raw.githubusercontent.com/agatho/grc-platform/main/scripts/server-diag-auth.sh | bash

set -uo pipefail

section() { echo; echo "── $1 ─────────────────────────────"; }

DB_CANDIDATES=(grc_daimon grc_platform)

section "Welche DB bedient der daimon-web-Container?"
docker inspect --format='ENV: {{range .Config.Env}}{{println "  " .}}{{end}}' daimon-web-daimon-1 2>/dev/null \
  | grep -iE "database_url|db_name" \
  || echo "  (container not found)"

for DB in "${DB_CANDIDATES[@]}"; do
  if ! docker exec arctos-postgres-1 psql -U grc -lqt | cut -d '|' -f 1 | grep -qw "$DB"; then
    continue
  fi
  section "DB: $DB — Users (ohne Hash-Inhalt)"
  docker exec arctos-postgres-1 psql -U grc -d "$DB" -c "
    SELECT
      id,
      email,
      is_active,
      deleted_at IS NOT NULL AS is_deleted,
      length(password_hash) AS hash_len,
      substring(password_hash FROM 1 FOR 7) AS hash_algo,
      created_at::date AS created
    FROM \"user\"
    ORDER BY created_at
    LIMIT 20;
  " 2>&1

  section "DB: $DB — Org-Zugehörigkeit pro User"
  docker exec arctos-postgres-1 psql -U grc -d "$DB" -c "
    SELECT u.email, o.name AS org, uor.role
    FROM \"user\" u
    LEFT JOIN user_organization_role uor ON uor.user_id = u.id
    LEFT JOIN organization o ON o.id = uor.org_id
    ORDER BY u.created_at
    LIMIT 20;
  " 2>&1
done

section "Auth-relevante Logs aus dem daimon-web-Container (letzte 50 Zeilen)"
docker logs --tail 50 daimon-web-daimon-1 2>&1 | grep -iE "auth|login|password|credentials|session" | tail -30 || true

echo
echo "── DIAG AUTH COMPLETE ──"
