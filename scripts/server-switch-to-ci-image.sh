#!/usr/bin/env bash
# Switch both web containers from the broken ghcr.io/arctos/grc-web:latest
# (where login fails with "Failed query" despite a working DB) to the
# CI-built ghcr.io/agatho/grc-platform/grc-web:latest — that image's
# auth path is proven green by the CI e2e-smoke job.
#
# Safe to re-run. Creates a backup of docker-compose.yml before touching
# anything. Does NOT drop or migrate data.
#
# Needs GITHUB_TOKEN or a prior `docker login ghcr.io` on the host to
# pull a private GHCR package.

set -euo pipefail

OLD_IMAGE="ghcr.io/arctos/grc-web:latest"
NEW_IMAGE="ghcr.io/agatho/grc-platform/grc-web:latest"
COMPOSE=/opt/arctos/docker-compose.production.yml
BACKUP="$COMPOSE.bak.$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$COMPOSE" ]; then
  COMPOSE=/opt/arctos/docker-compose.yml
  BACKUP="$COMPOSE.bak.$(date +%Y%m%d-%H%M%S)"
fi

echo "── Plan ─────────────────────────────"
echo "  compose file: $COMPOSE"
echo "  backup to   : $BACKUP"
echo "  from image  : $OLD_IMAGE"
echo "  to image    : $NEW_IMAGE"
echo

if ! grep -q "$OLD_IMAGE" "$COMPOSE"; then
  echo "  (current compose already uses a different image — aborting to avoid surprise)"
  grep -nE "image:" "$COMPOSE" | head
  exit 2
fi

cp "$COMPOSE" "$BACKUP"
echo "Backup created."

# Try to pull the new image first — fail fast if GHCR access isn't configured
echo
echo "── Pull new image ──"
if ! docker pull "$NEW_IMAGE"; then
  cat <<EOF

Pull failed. The agatho/grc-platform repo's package might be private —
you need to authenticate to GHCR with a classic PAT that has
\`read:packages\`:

  echo "\$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin

Then re-run this script.
EOF
  exit 3
fi

# Swap image reference in compose, keeping everything else intact
sed -i "s|$OLD_IMAGE|$NEW_IMAGE|g" "$COMPOSE"
echo
echo "── Diff ──"
diff -u "$BACKUP" "$COMPOSE" || true

echo
echo "── docker compose up -d ──"
cd /opt/arctos
docker compose -f "$COMPOSE" up -d

echo
echo "── Container status after switch ──"
sleep 3
docker compose -f "$COMPOSE" ps

echo
echo "── Live /login probe (caddy-fronted) ──"
for URL in https://arctos.charliehund.de/login https://daimon.arctos.charliehund.de/login; do
  echo "  $URL → $(curl -sS -o /dev/null -w '%{http_code}' "$URL")"
done

echo
echo "Next: try logging in via the browser."
echo "If login still fails, run scripts/server-auth-real-attempt.sh again —"
echo "the new image logs err.cause properly so we'll see the real pg error."
