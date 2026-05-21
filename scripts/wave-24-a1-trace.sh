#!/usr/bin/env bash
# Wave-24 A1 live trace runner.
#
# Hits the production /api/v1/_debug/finding-insert-trace endpoint with
# a valid controlId after an admin login, dumps the JSON so the
# operator can read which layer drops the FK.
#
# Prereqs on the production host:
#   - ARCTOS_DEBUG_TRACE_ENABLED=1 set in /opt/arctos/.env
#   - The current admin email + password are exported as env vars
#     (see usage below — avoid passing the password as a CLI arg so it
#     doesn't end up in shell history)
#
# Usage:
#   export ARCTOS_ADMIN_EMAIL='admin@arctos.dev'
#   export ARCTOS_ADMIN_PW='...'
#   bash scripts/wave-24-a1-trace.sh
#
# Optional overrides:
#   ARCTOS_BASE_URL  (default: https://arctos.charliehund.de)
#
# Once the trace reveals the root cause, the next operator can delete
# this script + the /_debug/finding-insert-trace folder + remove
# ARCTOS_DEBUG_TRACE_ENABLED from /opt/arctos/.env.

set -euo pipefail

BASE="${ARCTOS_BASE_URL:-https://arctos.charliehund.de}"
EMAIL="${ARCTOS_ADMIN_EMAIL:?ARCTOS_ADMIN_EMAIL not set}"
PW="${ARCTOS_ADMIN_PW:?ARCTOS_ADMIN_PW not set}"

JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

pp() {
  if command -v jq >/dev/null 2>&1; then jq .; else cat; fi
}

echo "▶ 1. Fetching CSRF token..."
CSRF_RES=$(curl -sc "$JAR" "$BASE/api/auth/csrf")
CSRF=$(echo "$CSRF_RES" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
if [ -z "$CSRF" ]; then
  echo "FAIL: could not extract CSRF token from response:" >&2
  echo "$CSRF_RES" >&2
  exit 1
fi
echo "  CSRF: ${CSRF:0:16}... (len=${#CSRF})"

echo "▶ 2. Logging in as $EMAIL..."
LOGIN_HTTP=$(curl -sb "$JAR" -c "$JAR" -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PW" \
  --data-urlencode "redirect=false" \
  --data-urlencode "json=true")
echo "  Login HTTP: $LOGIN_HTTP"

SESSION=$(curl -sb "$JAR" "$BASE/api/auth/session")
USER_EMAIL=$(echo "$SESSION" | sed -n 's/.*"email":"\([^"]*\)".*/\1/p')
if [ -z "$USER_EMAIL" ]; then
  echo "FAIL: no session established. Response:" >&2
  echo "$SESSION" >&2
  exit 1
fi
echo "  Authenticated as: $USER_EMAIL"

echo "▶ 3. Fetching a valid controlId..."
CTRLS=$(curl -sb "$JAR" "$BASE/api/v1/controls?limit=1")
CTRL_ID=$(echo "$CTRLS" | sed -n 's/.*"id":"\([a-f0-9-]\{36\}\)".*/\1/p' | head -1)
if [ -z "$CTRL_ID" ]; then
  echo "FAIL: no control found. Response:" >&2
  echo "$CTRLS" >&2
  exit 1
fi
echo "  controlId: $CTRL_ID"

echo "▶ 4. Running A1 trace via /api/v1/_debug/finding-insert-trace..."
TRACE=$(curl -sb "$JAR" -X POST \
  "$BASE/api/v1/_debug/finding-insert-trace" \
  -H "content-type: application/json" \
  --data-binary "{\"controlId\":\"$CTRL_ID\"}")

echo ""
echo "═══════════════ TRACE OUTPUT ═══════════════"
echo "$TRACE" | pp
echo "════════════════════════════════════════════"

echo ""
echo "Done. Interpret the trace using docs/audits/wave-24-a1-hypothesis.md:"
echo "  - traces[1].result has control_id NOT null → DB accepts FK via raw SQL"
echo "  - traces[2].result has controlId NOT null  → Drizzle path also fine"
echo "  - both null → DB-side trigger/RLS is stripping FKs"
echo "  - direct OK + drizzle null → Drizzle schema-bundle drift (H2)"
echo "  - both null even though deployed code looks correct → stale build (H1)"
