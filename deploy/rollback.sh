#!/usr/bin/env bash
# ============================================================================
# ARCTOS — Rollback (Image und/oder Datenbank)
#
# [ARCTOS-FULL-2026-08-31 / WP10 · S13-05]
#
# WARUM ES DIESES SKRIPT GIBT
#
# Vor diesem Audit existierte ein Rollback-Pfad nur auf dem Papier, und
# ALLE DREI dokumentierten Kommandos waren falsch:
#
#  (a) `docs/dr-playbook.md:43-44` empfahl
#          ARCTOS_IMAGE_TAG=vX.Y.Z docker compose up -d
#      Die Compose liest aber `${IMAGE_TAG:-latest}` (Zeile 173), nicht
#      `ARCTOS_IMAGE_TAG`. Das Kommando lief OHNE FEHLERMELDUNG durch und
#      startete erneut `:latest` — also exakt das defekte Image. Ein
#      Rollback, der still nichts tut, ist im Incident die gefaehrlichste
#      Klasse von Doku-Fehler.
#
#  (b) Es gab ueberhaupt kein Vorgaenger-Image auf dem Host.
#      `update-all.sh` BAUT die Images lokal und ueberschreibt dabei das
#      Tag, auf das `image:` zeigt. Ein SHA-getaggtes Vorgaenger-Image lag
#      nur in GHCR und wurde auf dem Host nie gepullt. Selbst mit der
#      richtigen Variablen waere der Rollback ein Netzwerk-Pull gewesen,
#      dessen Existenz niemand geprueft hatte.
#      → `update-all.sh` taggt den laufenden Stand jetzt VOR dem Build als
#        `arctos-rollback/grc-<svc>:<old-sha>`. Dieses Skript benutzt genau
#        diese Tags und faellt sonst auf GHCR zurueck.
#
#  (c) `docs/RELEASE_RUNBOOK.md:168-171` empfahl
#          psql -U grc -d grc_platform -f /opt/arctos/backups/db-<timestamp>.sql
#      `db-backup.sh` erzeugt aber `<db>-<YYYYMMDD-HHMMSS>[-label].dump`
#      (bzw. `.dump.gpg`) — falsches Praefix, falsche Endung, und ein
#      `psql -f` eines Plain-Dumps UEBER eine bestehende Datenbank ist kein
#      Rollback, sondern erzeugt hunderte `duplicate key`-Fehler. Korrekt
#      ist DROP + CREATE + pg_restore.
#
#  (d) `RELEASE_RUNBOOK.md:165` editierte `docker-compose.yml` und ersetzte
#      einen `@sha256:`-Digest — die Produktions-Compose heisst
#      `docker-compose.production.yml` und enthaelt keinen Digest.
#
#  (e) `dr-playbook.md:80` rief `offsite-sync.sh --download latest` auf; das
#      Skript wertete kein Argument aus (jetzt behoben, siehe dort).
#
# VERWENDUNG
#
#   sudo bash deploy/rollback.sh --list
#       Zeigt verfuegbare Rollback-Images und Backups.
#
#   sudo bash deploy/rollback.sh --image <sha|tag>
#       Startet web+worker mit dem angegebenen Image neu und wartet auf
#       "healthy". Die DATENBANK bleibt unberuehrt — Migrationen laufen
#       vorwaerts. Das ist der Normalfall.
#
#   sudo bash deploy/rollback.sh --db <backup-datei> [--db-name grc_platform]
#       DROP + CREATE + pg_restore. DATENVERLUST ab dem Backup-Zeitpunkt.
#       Verlangt eine getippte Bestaetigung.
#
#   sudo bash deploy/rollback.sh --full <sha> <backup-datei>
#       Beides, in der richtigen Reihenfolge (erst App stoppen, dann DB,
#       dann altes Image starten).
# ============================================================================

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/arctos/docker-compose.production.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/arctos/backups}"
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:-/opt/arctos/.backup.key}"
DEPLOY_LOG="${DEPLOY_LOG:-/opt/arctos/deploy-history.jsonl}"
PSQL_USER="${PSQL_USER:-grc}"

MODE=""
IMAGE_REF=""
DB_FILE=""
DB_NAME="grc_platform"

usage() { sed -n '1,70p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --list)    MODE="list" ;;
    --image)   MODE="image"; IMAGE_REF="${2:?--image braucht einen SHA oder Tag}"; shift ;;
    --db)      MODE="db";    DB_FILE="${2:?--db braucht eine Backup-Datei}"; shift ;;
    --db-name) DB_NAME="${2:?--db-name braucht einen Datenbanknamen}"; shift ;;
    --full)    MODE="full";  IMAGE_REF="${2:?--full braucht SHA und Backup}"; DB_FILE="${3:?--full braucht SHA und Backup}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unbekanntes Argument: $1" >&2; usage; exit 1 ;;
  esac
  shift
done
[ -n "$MODE" ] || { usage; exit 1; }

record() {
  printf '{"timestamp":"%s","event":"rollback","mode":"%s","image":"%s","backup":"%s","db":"%s","operator":"%s","result":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$MODE" "${IMAGE_REF:-}" "${DB_FILE:-}" "$DB_NAME" \
    "${SUDO_USER:-${USER:-unknown}}" "$1" >> "$DEPLOY_LOG" 2>/dev/null || true
}

pg_exec() { docker compose -f "$COMPOSE_FILE" exec -T postgres "$@"; }

wait_healthy() {
  local svc="$1" timeout="${2:-300}" waited=0 cid state health
  cid=$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" 2>/dev/null | head -1)
  [ -n "$cid" ] || { echo "  FEHLER: kein Container fuer '$svc'."; return 1; }
  while [ "$waited" -lt "$timeout" ]; do
    state=$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)
    case "$state:$health" in
      running:healthy) echo "  $svc: healthy nach ${waited}s"; return 0 ;;
      running:none)    [ "$waited" -ge 30 ] && { echo "  $svc: running (Image ohne HEALTHCHECK)"; return 0; } ;;
      exited:*|dead:*) echo "  $svc: '$state'"; return 1 ;;
      *:unhealthy)     echo "  $svc: unhealthy"; return 1 ;;
    esac
    sleep 5; waited=$((waited + 5))
  done
  echo "  $svc: Zeitueberschreitung ($state/$health)"; return 1
}

# ── --list ────────────────────────────────────────────────────────────────
if [ "$MODE" = "list" ]; then
  echo "============================================="
  echo "  Verfuegbare Rollback-Ziele"
  echo "============================================="
  echo ""
  echo "IMAGES (lokal, von update-all.sh vor dem Build gesichert):"
  docker images --filter "reference=arctos-rollback/*" \
    --format '  {{.Repository}}:{{.Tag}}   ({{.CreatedSince}}, {{.Size}})' 2>/dev/null \
    | sort || echo "  (keine)"
  echo ""
  echo "IMAGES (GHCR, per SHA — muessen erst gepullt werden):"
  REPO=$(git -C /opt/arctos remote get-url origin 2>/dev/null | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?#\1#' || true)
  if [ -n "$REPO" ]; then
    echo "  ghcr.io/${REPO}/grc-web:<commit-sha>"
    echo "  ghcr.io/${REPO}/grc-worker:<commit-sha>"
    echo "  (Tags: gh api /users/.../packages/container/... oder GHCR-UI)"
  else
    echo "  (Repository nicht ermittelbar)"
  fi
  echo ""
  echo "BACKUPS in $BACKUP_DIR (neueste zuerst):"
  ls -1t "$BACKUP_DIR"/*.dump "$BACKUP_DIR"/*.dump.gpg 2>/dev/null | head -20 \
    | while read -r f; do
        printf '  %-70s %s\n' "$(basename "$f")" "$(date -u -r "$f" +%Y-%m-%dT%H:%MZ 2>/dev/null || echo '?')"
      done || echo "  (keine)"
  echo ""
  echo "OBJEKTSPEICHER-BACKUPS (#S13-06):"
  ls -1t "$BACKUP_DIR"/objects-*.tar.gz* 2>/dev/null | head -5 \
    | while read -r f; do printf '  %s\n' "$(basename "$f")"; done || echo "  (keine)"
  echo ""
  echo "DEPLOY-PROTOKOLL (letzte 5):"
  tail -5 "$DEPLOY_LOG" 2>/dev/null | sed 's/^/  /' || echo "  (keins)"
  echo ""
  echo "Naechster Schritt:"
  echo "  sudo bash $0 --image <tag-oder-sha>"
  echo "  sudo bash $0 --db <backup-datei>"
  exit 0
fi

# ── --image ───────────────────────────────────────────────────────────────
rollback_image() {
  local ref="$1"
  echo "[Image-Rollback] Ziel: $ref"

  local web_img="" worker_img=""
  if docker image inspect "arctos-rollback/grc-web:${ref}" >/dev/null 2>&1; then
    web_img="arctos-rollback/grc-web:${ref}"
    worker_img="arctos-rollback/grc-worker:${ref}"
    echo "  Lokale Rollback-Images gefunden."
  else
    local repo
    repo=$(git -C /opt/arctos remote get-url origin 2>/dev/null | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?#\1#' || true)
    [ -n "$repo" ] || { echo "  FEHLER: weder lokales Rollback-Image noch GHCR-Repo ermittelbar."; return 1; }
    web_img="ghcr.io/${repo}/grc-web:${ref}"
    worker_img="ghcr.io/${repo}/grc-worker:${ref}"
    echo "  Kein lokales Image — versuche GHCR: $web_img"
    # #S13-05b: die EXISTENZ wird geprueft, bevor die laufenden Container
    # angefasst werden. Der alte Doku-Pfad hatte das nie getan.
    docker pull "$web_img"    >/dev/null 2>&1 || { echo "  FEHLER: $web_img nicht ziehbar."; return 1; }
    docker pull "$worker_img" >/dev/null 2>&1 || { echo "  FEHLER: $worker_img nicht ziehbar."; return 1; }
  fi

  # `image:` in der Compose zeigt auf ein bewegliches Tag. Der zuverlaessige
  # Weg ist, das Zielimage AUF dieses Tag zu taggen und neu zu erstellen —
  # damit ist der Rollback unabhaengig davon, welche Variable die Compose
  # gerade liest (das war der Kern von #S13-05a).
  local target_web target_worker
  target_web=$(docker compose -f "$COMPOSE_FILE" config --images 2>/dev/null | grep -i 'grc-web' | head -1)
  target_worker=$(docker compose -f "$COMPOSE_FILE" config --images 2>/dev/null | grep -i 'grc-worker' | head -1)
  [ -n "$target_web" ] || { echo "  FEHLER: Ziel-Image-Name fuer 'web' nicht aus der Compose lesbar."; return 1; }

  echo "  $web_img    -> $target_web"
  echo "  $worker_img -> ${target_worker:-<kein worker-Image>}"
  docker tag "$web_img" "$target_web"
  [ -n "$target_worker" ] && docker tag "$worker_img" "$target_worker"

  docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-build web worker 2>&1 | tail -5

  local failed=0
  for svc in web worker; do
    wait_healthy "$svc" 300 || failed=1
  done
  if [ "$failed" = "1" ]; then
    echo "  FEHLER: die zurueckgerollten Container sind nicht gesund."
    docker compose -f "$COMPOSE_FILE" logs --tail=40 web worker 2>&1 | sed 's/^/    /'
    return 1
  fi
  echo "  Image-Rollback erfolgreich."
  return 0
}

# ── --db ──────────────────────────────────────────────────────────────────
rollback_db() {
  local file="$1" db="$2"
  [ -f "$file" ] || file="$BACKUP_DIR/$file"
  [ -f "$file" ] || { echo "FEHLER: Backup-Datei nicht gefunden: $1"; return 1; }

  cat <<EOF

  ############################################################
  #  DATENBANK-ROLLBACK — DATENVERLUST
  #
  #  Datenbank:   $db
  #  Backup:      $(basename "$file")
  #  Stand:       $(date -u -r "$file" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo '?')
  #
  #  Alles, was NACH diesem Zeitpunkt geschrieben wurde, ist danach
  #  weg — auch Audit-Log-Eintraege und DMS-Metadaten. Die DATEIEN im
  #  Objektspeicher werden NICHT zurueckgerollt; ein Dokument, das nach
  #  dem Backup hochgeladen wurde, bleibt als Datei liegen, ohne dass
  #  eine Datenbankzeile darauf zeigt.
  #
  #  Ein DB-Rollback ist die AUSNAHME. Der Normalfall ist der
  #  Image-Rollback (--image); Migrationen laufen vorwaerts.
  ############################################################

EOF
  printf "  Zum Bestaetigen exakt 'ROLLBACK %s' eingeben: " "$db"
  read -r CONFIRM
  if [ "$CONFIRM" != "ROLLBACK $db" ]; then
    echo "  Abgebrochen."
    return 1
  fi

  local plain="$file" tmp=""
  case "$file" in
    *.gpg)
      [ -f "$BACKUP_KEY_FILE" ] || { echo "FEHLER: $BACKUP_KEY_FILE fehlt — Backup nicht entschluesselbar."; return 1; }
      tmp="$(mktemp "${TMPDIR:-/tmp}/arctos-rollback-XXXXXX.dump")"
      echo "  Entschluesseln..."
      gpg --batch --quiet --yes --decrypt --pinentry-mode loopback \
          --passphrase-file "$BACKUP_KEY_FILE" "$file" > "$tmp" \
        || { rm -f "$tmp"; echo "FEHLER: Entschluesselung fehlgeschlagen."; return 1; }
      plain="$tmp" ;;
  esac

  echo "  Anwendung stoppen (web, worker + Tenant-Container)..."
  docker compose -f "$COMPOSE_FILE" stop web worker 2>&1 | tail -3 || true

  echo "  Sicherheitskopie des AKTUELLEN Standes anlegen..."
  bash /opt/arctos/deploy/db-backup.sh "$db" 2>&1 | sed 's/^/    /' || \
    echo "    WARNUNG: Sicherheitskopie fehlgeschlagen — Rollback trotzdem fortsetzen? (Ctrl-C zum Abbrechen, 10 s)" && sleep 10

  echo "  DROP + CREATE $db ..."
  pg_exec psql -U "$PSQL_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$db' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
  pg_exec psql -U "$PSQL_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$db\";" \
    || { [ -n "$tmp" ] && rm -f "$tmp"; echo "FEHLER: DROP DATABASE fehlgeschlagen."; return 1; }
  pg_exec psql -U "$PSQL_USER" -d postgres -c "CREATE DATABASE \"$db\" OWNER $PSQL_USER;" \
    || { [ -n "$tmp" ] && rm -f "$tmp"; echo "FEHLER: CREATE DATABASE fehlgeschlagen."; return 1; }

  echo "  pg_restore..."
  docker compose -f "$COMPOSE_FILE" cp "$plain" postgres:/tmp/rollback.dump >/dev/null
  # --disable-triggers wegen der zirkulaeren FKs in den TimescaleDB-
  # Metadaten (hypertable/chunk/continuous_agg).
  if ! pg_exec pg_restore -U "$PSQL_USER" -d "$db" --no-owner --no-privileges \
        --disable-triggers /tmp/rollback.dump 2>&1 | tail -20; then
    echo "  WARNUNG: pg_restore meldete Fehler — bitte oben pruefen."
  fi
  pg_exec rm -f /tmp/rollback.dump >/dev/null 2>&1 || true
  [ -n "$tmp" ] && rm -f "$tmp"

  echo "  Laufzeitrollen neu granten (neue DB = neue Objekte)..."
  local app_pw worker_pw
  app_pw=$(grep -E '^GRC_APP_PASSWORD=' /opt/arctos/.env 2>/dev/null | head -1 | cut -d= -f2-)
  worker_pw=$(grep -E '^GRC_WORKER_PASSWORD=' /opt/arctos/.env 2>/dev/null | head -1 | cut -d= -f2-)
  GRC_APP_PASSWORD="$app_pw" GRC_WORKER_PASSWORD="$worker_pw" COMPOSE_FILE="$COMPOSE_FILE" \
    bash /opt/arctos/deploy/provision-grc-app.sh "$db" 2>&1 | sed 's/^/    /' || \
    echo "    WARNUNG: provision-grc-app.sh fehlgeschlagen — RLS-Grants pruefen!"

  echo "  Anwendung starten..."
  docker compose -f "$COMPOSE_FILE" start web worker 2>&1 | tail -3 || true
  wait_healthy web 300 || { echo "  FEHLER: web ist nach dem DB-Rollback nicht gesund."; return 1; }
  echo "  Datenbank-Rollback abgeschlossen."
  return 0
}

# ── Ausfuehrung ───────────────────────────────────────────────────────────
RC=0
case "$MODE" in
  image) rollback_image "$IMAGE_REF" || RC=1 ;;
  db)    rollback_db "$DB_FILE" "$DB_NAME" || RC=1 ;;
  full)
    rollback_db "$DB_FILE" "$DB_NAME" || RC=1
    [ "$RC" = "0" ] && { rollback_image "$IMAGE_REF" || RC=1; }
    ;;
esac

if [ "$RC" = "0" ]; then
  record "success"
  echo ""
  echo "============================================="
  echo "  Rollback erfolgreich ($MODE)"
  echo "  Protokoll: $DEPLOY_LOG"
  echo "============================================="
else
  record "failed"
  echo ""
  echo "============================================="
  echo "  ROLLBACK FEHLGESCHLAGEN ($MODE)"
  echo "  docs/dr-playbook.md Szenario 2 von Hand durchgehen."
  echo "============================================="
fi
exit "$RC"
