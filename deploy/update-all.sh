#!/bin/bash
# ============================================================================
# ARCTOS — Update aller Container (Main + alle Tenants)
#
# Was dieses Script macht:
# 1. git pull im Haupt-Repo
# 2. Docker Image neu bauen
# 3. Migrationen auf alle Datenbanken anwenden
# 4. Haupt-Container neu starten
# 5. Alle Tenant-Container neu starten
#
# Verwendung: sudo bash /opt/arctos/deploy/update-all.sh
# ============================================================================

set -euo pipefail

cd /opt/arctos
COMPOSE_FILE="/opt/arctos/docker-compose.production.yml"

echo "============================================="
echo "  ARCTOS — Update aller Instanzen"
echo "  $(date -u +"%Y-%m-%d %H:%M UTC")"
echo "============================================="
echo ""

# ── 1. Code aktualisieren ─────────────────────────────────
echo "[1/5] Code aktualisieren..."
OLD_COMMIT=$(git rev-parse HEAD)
git pull origin main
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  echo "  Kein Update verfuegbar ($OLD_COMMIT)"
else
  echo "  $OLD_COMMIT → $NEW_COMMIT"
fi

# ── 1a. Self-Update: mit neuer Script-Version neu starten ─
# bash fuehrt das bereits geladene Script zu Ende — Aenderungen an
# update-all.sh selbst wuerden sonst erst beim UEBERNAECHSTEN Lauf
# greifen (so geschehen bei der Env-Migration). Re-exec einmalig,
# wenn der Pull dieses Script veraendert hat.
if [ "${ARCTOS_UPDATE_REEXEC:-0}" != "1" ] && [ "$OLD_COMMIT" != "$NEW_COMMIT" ] \
   && ! git diff --quiet "$OLD_COMMIT" "$NEW_COMMIT" -- deploy/update-all.sh; then
  echo "  update-all.sh wurde aktualisiert — starte mit neuer Version neu..."
  ARCTOS_UPDATE_REEXEC=1 exec bash /opt/arctos/deploy/update-all.sh
fi

# ── 1b. Env-Migration: neue Variablen sicherstellen ───────
# setup-hetzner.sh erzeugt die .env nur EINMAL bei Erstinstallation.
# Variablen, die spaetere Releases einfuehren, muessen nachgezogen
# werden — sonst laufen die Container mit leeren Werten. Dieser Block
# ist idempotent: bestehende Eintraege (auch auskommentierte) werden
# NIE angefasst, Pflicht-Secrets werden generiert, optionale Variablen
# nur als kommentierter Hinweis ergaenzt.
echo ""
echo "[1b/5] Env-Migration (neue Variablen sicherstellen)..."
ENV_FILE=/opt/arctos/.env

ensure_env_secret() {
  # $1 = Key, $2 = Generator-Kommando
  if ! grep -Eq "^#? *${1}=" "$ENV_FILE"; then
    printf '\n# Auto-generiert von update-all.sh am %s\n%s=%s\n' \
      "$(date -u +%F)" "$1" "$($2)" >> "$ENV_FILE"
    echo "  + $1 generiert"
  fi
}

ensure_env_hint() {
  # $1 = Key, $2 = Kommentar-Hinweis
  if ! grep -Eq "^#? *${1}=" "$ENV_FILE"; then
    printf '\n# %s\n# %s=\n' "$2" "$1" >> "$ENV_FILE"
    echo "  + $1 als Hinweis ergaenzt (optional, auskommentiert)"
  fi
}

# Pflicht: Encrypt-at-rest fuer Connector-/SSO-Secrets (seit 2026-07-10).
# Ohne Key verweigern die betroffenen Routen das Speichern (fail-hard by design).
ensure_env_secret "SECRET_ENCRYPTION_KEY" "openssl rand -base64 32"

# Pflicht (#SEC-F01): Passwort fuer die Nicht-Superuser-Runtime-Rolle grc_app.
# Die App verbindet zur Laufzeit als grc_app (RLS wirkt); Migrationen laufen
# weiter als grc. provision-grc-app.sh (weiter unten) legt die Rolle mit
# diesem Passwort an und grantet Least-Privilege-DML.
ensure_env_secret "GRC_APP_PASSWORD" "openssl rand -hex 24"

# MinIO-Sidecar (docker-compose.production.yml): Root-Passwort generieren.
# Aktiviert wird das S3-Backend erst durch STORAGE_BACKEND=s3 + S3_*-Werte.
ensure_env_secret "MINIO_ROOT_PASSWORD" "openssl rand -hex 24"

# Optional: AI-Provider (Policy-Entwurf, Kontroll-Vorschlaege, Gap-Erklaerung;
# Embeddings brauchen OPENAI_API_KEY oder Ollama)
ensure_env_hint "ANTHROPIC_API_KEY" "AI-Assist via Claude (optional)"
ensure_env_hint "OPENAI_API_KEY" "AI-Assist + Kontroll-Embeddings via OpenAI (optional)"

# Optional: DMS-Storage-Backend (Default: lokales FS, kein Eintrag noetig)
ensure_env_hint "STORAGE_BACKEND" "DMS-Storage: local (Default) oder s3 — bei s3 zusaetzlich S3_ENDPOINT/S3_REGION/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY setzen"

# Optional: ClamAV-Upload-Scan (Container clamav/clamd, sonst wird uebersprungen)
ensure_env_hint "CLAMAV_HOST" "ClamAV-Virus-Scan fuer DMS-Uploads (optional, z.B. clamav bei Sidecar-Container)"

# ── 2. Docker Images neu bauen (web + worker) ─────────────
# Worker MUSS mit gebaut werden, sonst läuft die Cron-Engine noch mit
# einem alten Image — typischer Crash-Loop wäre "Cannot find module ..."
# nach Schema- oder Dep-Änderungen. Beide Images nutzen denselben
# Layer-Cache; Worker-Build dauert ~30 s wenn nur Source geändert.
#
# #WAVE23.4: pass GIT_SHA / GIT_BRANCH / BUILD_TIME as build-args so
# /api/v1/meta/build returns the real running commit instead of
# "unknown". CI already passes these via docker/build-push-action's
# build-args input; this mirrors it for the local-build deploy path.
# Reading from the just-pulled checkout, so values match the source
# tree that's about to be baked into the image.
echo ""
echo "[2/5] Docker Images neu bauen (web + worker)..."
export GIT_SHA="$(git rev-parse HEAD)"
export GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  GIT_SHA=${GIT_SHA:0:8} GIT_BRANCH=${GIT_BRANCH} BUILD_TIME=${BUILD_TIME}"
docker compose -f "$COMPOSE_FILE" build \
  --build-arg "GIT_SHA=${GIT_SHA}" \
  --build-arg "GIT_BRANCH=${GIT_BRANCH}" \
  --build-arg "BUILD_TIME=${BUILD_TIME}" \
  web worker 2>&1 | tail -15

# ── 3. Migrationen auf alle DBs ──────────────────────────
echo ""
echo "[3/5] Migrationen anwenden..."

# Main DB
echo "  DB: grc_platform (main)"
for f in $(ls /opt/arctos/packages/db/drizzle/0*.sql 2>/dev/null | sort); do
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d grc_platform -f "/dev/stdin" < "$f" >/dev/null 2>&1 || true
done

# Tenant DBs
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    TENANT=$(basename "$tdir")
    DB_NAME="grc_${TENANT}"
    echo "  DB: $DB_NAME (tenant: $TENANT)"
    for f in $(ls /opt/arctos/packages/db/drizzle/0*.sql 2>/dev/null | sort); do
      docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d "$DB_NAME" -f "/dev/stdin" < "$f" >/dev/null 2>&1 || true
    done
  done
fi

# ── 3b. Katalog-Baseline-Top-up (idempotent) ──────────────
# Alle Kataloge sind scope='platform'. Ältere Tenants (vor Einführung
# des Katalog-Seeders in create-tenant.sh) haben keine Frameworks.
# Die Seeds sind via ON CONFLICT DO NOTHING idempotent → einfach neu
# einspielen, bereits vorhandene Rows werden übersprungen.
echo ""
echo "[3b/5] Katalog-Baseline top-up (idempotent, alle DBs)..."
SEEDER=/opt/arctos/deploy/seed-catalogs.sh
if [ -f "$SEEDER" ]; then
  chmod +x "$SEEDER" 2>/dev/null || true
  echo "  → grc_platform"
  bash "$SEEDER" grc_platform 2>&1 | sed 's/^/    /' || true
  if [ -d /opt/arctos/tenants ]; then
    for tdir in /opt/arctos/tenants/*/; do
      [ -d "$tdir" ] || continue
      TENANT=$(basename "$tdir")
      echo "  → grc_${TENANT}"
      bash "$SEEDER" "grc_${TENANT}" 2>&1 | sed "s/^/    /" || true
    done
  fi
else
  echo "  FEHLER: $SEEDER fehlt — Tenants bleiben ohne Frameworks!"
fi

# ── 3c. Wave-21+22 Reference-Seed-Top-up (idempotent) ────
# Jenseits der Katalog-Frameworks landen weitere Reference- und
# Demo-Seeds NICHT automatisch über die Migration-Loop:
#
#   - seed_esrs_datapoints.sql           → 65 ESRS-Datapoints (B2)
#                                           POST /esg/metrics braucht das,
#                                           sonst 422 {datapointId:Required}.
#   - seedProgrammeTemplates() (TS)      → 4 Norm-Templates (ISO27001/22301,
#                                           GDPR, ISO42001) — Voraussetzung für
#                                           seed_demo_13_programmes.sql.
#   - seed_demo_13_programmes.sql        → 2 Journey-Instances (ISO 27001 Cert
#                                           2026 + DSGVO Roadmap) für die
#                                           Haupt-/Demo-DB grc_platform.
#   - seed_demo_14_july_features.sql     → Demo-Daten für die Juli-2026-Features
#                                           (Prozesslandkarte, Freigabekette,
#                                           Management-Review-Cockpit, DMS-
#                                           Effective-Dating + e-Signatur,
#                                           Risk-Acceptance, Retention) —
#                                           Main-DB only, wie seed_demo_13.
#
# Alle Seeds sind idempotent (ON CONFLICT DO NOTHING) — kann bei jedem
# Update neu laufen. Templates seeden wir nur in der Main-DB (Demo-Daten);
# Tenants können Programme manuell anlegen.
echo ""
echo "[3c/5] Wave-21+22 Reference-Seed-Top-up..."

# B2: ESG-Datapoints in jede DB (Reference-Data, kein Demo)
echo "  → seed_esrs_datapoints.sql (alle DBs)"
ESRS_FILE=/opt/arctos/packages/db/sql/seed_esrs_datapoints.sql
if [ -f "$ESRS_FILE" ]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U grc -d grc_platform -v ON_ERROR_STOP=0 -q -f /dev/stdin \
    < "$ESRS_FILE" 2>&1 | grep -E '^(ERROR|FATAL):' | head -3 | sed 's/^/    /' || true
  if [ -d /opt/arctos/tenants ]; then
    for tdir in /opt/arctos/tenants/*/; do
      [ -d "$tdir" ] || continue
      TENANT=$(basename "$tdir")
      docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U grc -d "grc_${TENANT}" -v ON_ERROR_STOP=0 -q -f /dev/stdin \
        < "$ESRS_FILE" 2>&1 | grep -E '^(ERROR|FATAL):' | head -3 | sed 's/^/    /' || true
    done
  fi
else
  echo "    (Datei fehlt — übersprungen)"
fi

# B6: Programme-Templates (TS-Seeder) + Demo-Journeys nur für Haupt-DB.
# Templates müssen VOR den Journeys laufen (FK-Lookup auf
# programme_template.code). Läuft im worker-Container, weil dessen
# Image (Dockerfile.worker) den ganzen Source-Tree mitkopiert
# (`COPY . .`) — das web-Image kopiert nur drizzle/ + sql/ und hat
# kein packages/db/src/ zur Laufzeit verfügbar.
echo "  → programme-templates (TS seeder via worker, Main-DB only)"
docker compose -f "$COMPOSE_FILE" exec -T worker \
  sh -c "cd /app && npx tsx packages/db/src/seeds/run-programme-templates.ts" 2>&1 \
  | sed 's/^/    /' || echo "    (Seeder-Fehler — manuell prüfen)"

echo "  → seed_demo_13_programmes.sql (Main-DB only)"
DEMO_PROG=/opt/arctos/packages/db/sql/seed_demo_13_programmes.sql
if [ -f "$DEMO_PROG" ]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U grc -d grc_platform -v ON_ERROR_STOP=0 -q -f /dev/stdin \
    < "$DEMO_PROG" 2>&1 | grep -E '^(ERROR|FATAL):' | head -3 | sed 's/^/    /' || true
fi

# Juli-2026-Features: Landkarte, Freigabekette/Kenntnisnahme, Management-
# Review-Cockpit, DMS Effective-Dating + e-Signatur (Hash-Kette via
# pgcrypto), Risk-Acceptance + Authority, Retention-Policy. Nur Main-DB
# (Demo-Daten der Meridian-Demo-Org). ON_ERROR_STOP=1, weil der Seed eine
# BEGIN/COMMIT-Transaktion ist — Teilausführung würde die Hash-Kette
# inkonsistent hinterlassen.
echo "  → seed_demo_14_july_features.sql (Main-DB only)"
DEMO_JULY=/opt/arctos/packages/db/sql/seed_demo_14_july_features.sql
if [ -f "$DEMO_JULY" ]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U grc -d grc_platform -v ON_ERROR_STOP=1 -q -f /dev/stdin \
    < "$DEMO_JULY" 2>&1 | grep -E '^(ERROR|FATAL):' | head -3 | sed 's/^/    /' || true
fi

# ── 3d. grc_app-Rolle provisionieren (#SEC-F01) ───────────
# Nach den Migrationen (Tabellen existieren) und VOR dem Container-Restart:
# die Nicht-Superuser-Rolle grc_app anlegen/aktualisieren und Least-Privilege-
# Grants auf alle DBs setzen. Erst danach dürfen web+worker mit
# APP_DATABASE_URL=grc_app neu starten. ALTER DEFAULT PRIVILEGES deckt künftige
# Tabellen ab. Schließt zugleich #SEC-F09 (FORCE RLS auf organization).
echo ""
echo "[3d/5] grc_app-Rolle provisionieren (Runtime als Nicht-Superuser)..."
GRC_APP_PW=$(grep -E '^GRC_APP_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
PROVISION=/opt/arctos/deploy/provision-grc-app.sh
if [ -z "$GRC_APP_PW" ]; then
  echo "  WARNUNG: GRC_APP_PASSWORD fehlt in .env — grc_app wird nicht provisioniert."
elif [ ! -f "$PROVISION" ]; then
  echo "  WARNUNG: $PROVISION fehlt — grc_app wird nicht provisioniert."
else
  chmod +x "$PROVISION" 2>/dev/null || true
  # DB-Liste: Main + alle Tenants (grc_<tenant>)
  PROV_DBS=(grc_platform)
  if [ -d /opt/arctos/tenants ]; then
    for tdir in /opt/arctos/tenants/*/; do
      [ -d "$tdir" ] || continue
      PROV_DBS+=("grc_$(basename "$tdir")")
    done
  fi
  GRC_APP_PASSWORD="$GRC_APP_PW" COMPOSE_FILE="$COMPOSE_FILE" \
    bash "$PROVISION" "${PROV_DBS[@]}" 2>&1 | sed 's/^/  /' || \
    echo "  WARNUNG: provision-grc-app.sh meldete Fehler — bitte prüfen."
fi

# ── 4. Haupt-Container neu starten (web + worker) ─────────
echo ""
echo "[4/5] Haupt-Container neu starten (web + worker)..."
# Sidecars nur starten, wenn sie in der .env aktiviert sind (2026-07-24:
# ClamAV hat auf dem 16-GB-Server einen Host-OOM mit verursacht — wer den
# Scan will, setzt CLAMAV_HOST aktiv; MinIO nur bei STORAGE_BACKEND=s3).
if grep -q '^STORAGE_BACKEND=s3' "$ENV_FILE" 2>/dev/null; then
  docker compose -f "$COMPOSE_FILE" up -d minio 2>&1 | tail -2 || true
  docker compose -f "$COMPOSE_FILE" up -d minio-init 2>&1 | tail -2 || true
else
  echo "  MinIO uebersprungen (STORAGE_BACKEND != s3)"
fi
if grep -q '^CLAMAV_HOST=' "$ENV_FILE" 2>/dev/null; then
  docker compose -f "$COMPOSE_FILE" up -d clamav 2>&1 | tail -2 || true
else
  echo "  ClamAV uebersprungen (CLAMAV_HOST nicht aktiv in .env)"
  docker compose -f "$COMPOSE_FILE" stop clamav 2>/dev/null || true
fi
docker compose -f "$COMPOSE_FILE" up -d --force-recreate web worker 2>&1 | tail -5

# Worker-Health quick-check: zeigt sofort ob die Cron-Engine startet
# oder im Crash-Loop steckt (Symptom für fehlende Module / Schema-Drift).
sleep 5
WORKER_STATE=$(docker compose -f "$COMPOSE_FILE" ps --format json worker 2>/dev/null | grep -oP '"State":"\K[^"]+' | head -1)
if [ "$WORKER_STATE" != "running" ]; then
  echo "  WARNUNG: Worker-Container nicht im Status 'running' (aktuell: ${WORKER_STATE:-unknown})."
  echo "  Letzte Worker-Logs:"
  docker compose -f "$COMPOSE_FILE" logs --tail=20 worker 2>&1 | sed 's/^/    /'
fi

# ── 4b. Tenant-Worker-Service sicherstellen (Backfill) ────
# Ältere Tenants wurden vor Einführung der per-Tenant-Worker-Architektur
# angelegt und haben in ihrer docker-compose.yml nur web-<name>. Das
# bedeutet: keine Cron-Verarbeitung pro Tenant (Programme-Deadlines, SoA-
# Sync, NIS2-Mahnungen etc. fallen aus). Der Helper ist idempotent —
# regeneriert die docker-compose.yml mit web + worker, preserved den
# bestehenden Host-Port. Backup wird einmalig als .pre-worker-backup
# abgelegt.
echo ""
echo "[4b/5] Tenant-Worker-Service sicherstellen (idempotent)..."
HELPER=/opt/arctos/deploy/ensure-tenant-worker.sh
if [ -f "$HELPER" ]; then
  chmod +x "$HELPER" 2>/dev/null || true
  bash "$HELPER" 2>&1 | sed 's/^/  /' || true
else
  echo "  WARNUNG: $HELPER fehlt — bestehende Tenants bekommen keinen Worker"
fi

# ── 5. Alle Tenant-Container neu starten ─────────────────
echo ""
echo "[5/5] Tenant-Container neu starten (web + worker)..."
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    TENANT=$(basename "$tdir")
    echo "  Tenant: $TENANT"
    cd "$tdir"
    docker compose up -d --force-recreate --build 2>&1 | tail -3

    # Worker-Health-Check pro Tenant: zeigt sofort ob die Cron-Engine für
    # diesen Tenant läuft oder im Crash-Loop steckt.
    sleep 3
    WORKER_STATE=$(docker compose ps --format json "worker-$TENANT" 2>/dev/null | grep -oP '"State":"\K[^"]+' | head -1)
    if [ -n "$WORKER_STATE" ] && [ "$WORKER_STATE" != "running" ]; then
      echo "    WARNUNG: worker-$TENANT nicht 'running' (aktuell: $WORKER_STATE)"
      docker compose logs --tail=15 "worker-$TENANT" 2>&1 | sed 's/^/      /'
    fi
    cd /opt/arctos
  done
fi

# ── Health-Checks ─────────────────────────────────────────
echo ""
echo "Health-Checks..."
sleep 10

# Main
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/login 2>/dev/null)
printf "  %-40s HTTP %s\n" "main (127.0.0.1:3000)" "$CODE"

# Tenants
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    TENANT=$(basename "$tdir")
    PORT=$(cd "$tdir" && docker compose ps --format json 2>/dev/null | grep -oP '"Publishers":\[\{[^}]*"PublishedPort":\K[0-9]+' | head -1)
    if [ -n "$PORT" ]; then
      CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:$PORT/login" 2>/dev/null)
      printf "  %-40s HTTP %s\n" "$TENANT (127.0.0.1:$PORT)" "$CODE"
    fi
  done
fi

echo ""
echo "============================================="
echo "  Update abgeschlossen: $NEW_COMMIT"
echo "============================================="
