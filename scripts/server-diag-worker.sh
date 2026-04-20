#!/usr/bin/env bash
# Follow-up: worker-crash + web-container-quelle
set -uo pipefail
section() { echo; echo "── $1 ──────────────────────────────"; }

section "Worker restart loop — letzte 200 Log-Zeilen"
docker logs --tail 200 arctos-worker-1 2>&1 || true

section "Worker: exit-code + crash-count"
docker inspect --format='State: {{.State.Status}} | ExitCode: {{.State.ExitCode}} | RestartCount: {{.RestartCount}} | StartedAt: {{.State.StartedAt}} | Error: {{.State.Error}}' arctos-worker-1 2>&1 || true

section "Worker image provenance"
docker inspect --format='Image: {{.Config.Image}} | Digest: {{index .Image}}' arctos-worker-1 2>&1 || true
docker images --digests | grep -iE "arctos-worker|grc-worker" | head -5

section "Web containers — welcher serviert port 3000?"
ss -tlnp 2>/dev/null | awk 'NR==1 || /:3000/' || true
echo
for c in $(docker ps --format '{{.Names}}' | grep -iE "web|arctos"); do
  echo "### $c"
  echo "image: $(docker inspect --format='{{.Config.Image}}' "$c")"
  echo "ports: $(docker inspect --format='{{range $p, $_ := .NetworkSettings.Ports}}{{$p}} {{end}}' "$c")"
  echo "status: $(docker inspect --format='{{.State.Status}} ({{.State.StartedAt}})' "$c")"
  echo
done

section "Web compose mapping"
(cd /opt/arctos && grep -nE "image:|ghcr\.io|web:" docker-compose.yml) 2>&1 | head -30

section "/login reachability (via caddy)"
curl -sSfI https://$(grep '^DOMAIN=' /opt/arctos/.env | cut -d= -f2)/login 2>&1 | head -8 || true

echo
echo "── WORKER+WEB DIAG COMPLETE ──"
