#!/usr/bin/env bash
# Trigger a real login via the public /api/auth endpoint, then dump the
# container log right after. This hits the actual bundled auth code path
# and surfaces whatever error Auth.js hits.
#
# Usage:
#   PASSWORD=...      bash server-auth-real-attempt.sh            # default daimon
#   TENANT=arctos PASSWORD=... bash server-auth-real-attempt.sh   # public
#
# Don't echo secrets — we only pass PASSWORD as env, never log it.

set -uo pipefail

TENANT="${TENANT:-daimon}"
PASSWORD="${PASSWORD:-}"

case "$TENANT" in
  daimon)
    URL="https://daimon.arctos.charliehund.de"
    CONTAINER="daimon-web-daimon-1"
    EMAIL="${EMAIL:-agatho@charliehund.de}"
    ;;
  arctos|public)
    URL="https://arctos.charliehund.de"
    CONTAINER="arctos-web-1"
    EMAIL="${EMAIL:-admin@arctos.dev}"
    ;;
  *)
    echo "unknown TENANT=$TENANT (use: daimon | arctos)"
    exit 2
    ;;
esac

if [ -z "$PASSWORD" ]; then
  read -rsp "Password for $EMAIL on $URL: " PASSWORD
  echo
fi

section() { echo; echo "── $1 ─────────────────────"; }

section "Pre-attempt log position"
BEFORE=$(date -u +%FT%TZ)
echo "timestamp before attempt: $BEFORE"

section "Step 1: fetch CSRF token"
CSRF_JSON=$(curl -sS -c /tmp/auth-probe-cookies.txt "$URL/api/auth/csrf" || echo "{}")
echo "csrf response: $CSRF_JSON"
CSRF=$(echo "$CSRF_JSON" | grep -oE '"csrfToken":"[^"]+"' | cut -d'"' -f4)
if [ -z "$CSRF" ]; then
  echo "  (no csrf token — endpoint might be wrong)"
else
  echo "  got token: ${CSRF:0:16}…"
fi

section "Step 2: POST credentials"
HTTP_CODE=$(curl -sS -o /tmp/auth-probe-body.html -w "%{http_code}" \
  -b /tmp/auth-probe-cookies.txt -c /tmp/auth-probe-cookies.txt \
  -X POST "$URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASSWORD" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "redirect=false" \
  --data-urlencode "callbackUrl=/" \
  --data-urlencode "json=true" || echo "curl_failed")

echo "HTTP: $HTTP_CODE"
head -c 500 /tmp/auth-probe-body.html 2>/dev/null || true
echo

section "Step 3: container logs since attempt"
sleep 2
docker logs --since "$BEFORE" "$CONTAINER" 2>&1 | tail -80

rm -f /tmp/auth-probe-cookies.txt /tmp/auth-probe-body.html
echo
echo "── AUTH-ATTEMPT COMPLETE ──"
