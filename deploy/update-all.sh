#!/bin/bash
# ============================================================================
# ARCTOS — Update aller Container (Main + alle Tenants)
#
# [ARCTOS-FULL-2026-08-31 / WP10 · S13-04, S13-19, S13-20, S13-21, S13-22]
#
# Der Deploy hatte weder Netz noch Rückweg. Was sich geändert hat:
#
#  * S13-04(a) KEIN PRE-DEPLOY-BACKUP. ADR-016 begründet den manuellen
#    Deploy ausdrücklich damit, dass Migrationen nicht zurückrollbar sind,
#    und `db-backup.sh` unterstützt `--pre-migration` genau dafür — dieses
#    Skript rief es NIE auf. Die Absicherung existierte als Skript und war
#    im Deploy-Pfad nicht verdrahtet; sie hing daran, dass der Operator
#    `runbook.md:57` gelesen hatte und daran dachte. Ein Migrationsabbruch
#    um 22:00 liess bis zu 19 h Datenverlust zurück (letzter Nacht-Dump
#    03:00). → Schritt 0: Backup, und zwar BLOCKIEREND.
#
#  * S13-04(b) MIGRATIONSFEHLER WURDEN VERWORFEN. Die Schleife lief mit
#    `>/dev/null 2>&1 || true` gegen jede Produktiv-DB — `set -euo
#    pipefail` in Zeile 15 war für genau den kritischen Teil ausgehebelt.
#    Anders als der Entrypoint gab das Skript nicht einmal eine Fehlerzahl
#    aus. → Der Migrationslauf benutzt jetzt denselben Runner wie CI, Dev
#    und der Entrypoint (`packages/db/src/migrate-all.ts` mit
#    `_arctos_migrations`-Ledger); ein Fehlschlag bricht den Deploy ab.
#    Damit entfällt zugleich S13-21: eine Sortierung, ein Ledger, keine
#    doppelte Anwendung.
#
#  * S13-04(c) DER HEALTH-CHECK WERTETE NICHTS AUS. `$CODE` wurde
#    ausgegeben und nie verglichen; ein Deploy, nach dem die Anwendung
#    HTTP 500 lieferte, endete mit "Update abgeschlossen" und Exit 0.
#    → Health-Gate mit Wartezeit, Auswertung und automatischem
#    Image-Rollback.
#
#  * S13-04(d) `provision-grc-app.sh`-FEHLER WAREN FOLGENLOS. Schlug die
#    Provisionierung fehl, wurde "WARNUNG:" gedruckt und die Container
#    trotzdem mit `APP_DATABASE_URL=grc_app:…` neu gestartet — die App
#    konnte sich dann nicht verbinden. Fehlte `GRC_APP_PASSWORD`, wurde die
#    Rolle gar nicht angelegt, ebenfalls nur mit Warnung. → Beides bricht
#    jetzt ab.
#
#  * S13-19 KEIN NACHWEIS, DASS DER DEPLOYTE COMMIT CI GRÜN DURCHLIEF.
#    Deployt wurde der Spitzenstand von `main`, ohne Tag, ohne Release,
#    ohne Abfrage des CI-Status. → Der CI-Status des Ziel-Commits wird per
#    `gh` abgefragt; ohne grünen Lauf bricht der Deploy ab
#    (`ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true` als sichtbare Ausnahme). Der
#    Deploy schreibt ausserdem ein Protokoll nach
#    /opt/arctos/deploy-history.jsonl — ADR-016 behauptete "im Audit-Log
#    sichtbar", ohne dass irgendetwas geschrieben wurde.
#
#  * S13-20 DEMO-DATEN IN DER PRODUKTIVEN HAUPT-DB. `seed_demo_13` und
#    `seed_demo_14` liefen bei JEDEM Update unbedingt gegen `grc_platform`
#    — ohne Abfrage von SEED_DEMO_DATA, NODE_ENV oder
#    ALLOW_DEMO_SEED_IN_PROD. Damit umging der Deploy-Pfad genau die
#    Schutzmassnahme, die für denselben Zweck im Entrypoint eingebaut ist
#    (#SEC-F04). `seed_demo_14` schreibt laut eigenem Kommentar in die
#    Hash-Kette. → Beide laufen nur noch mit ausdrücklichem
#    `ALLOW_DEMO_SEED_IN_PROD=true`.
#
#  * S13-22 KEIN ZERO-DOWNTIME-DEPLOY. `--force-recreate` stoppt und
#    startet; es gibt keine zweite Replik. Der Container-Healthcheck aus
#    S13-13 macht daraus wenigstens ein GESTEUERTES Fenster: der Deploy
#    wartet auf "healthy" und rollt sonst zurück. Echtes Zero-Downtime
#    braucht eine zweite Replik hinter Caddy — als Betreiber-Punkt
#    dokumentiert, siehe docs/runbook.md §6.
#
# Verwendung: sudo bash /opt/arctos/deploy/update-all.sh
#   ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true  CI-Status-Prüfung überspringen
#   ALLOW_DEMO_SEED_IN_PROD=true         Demo-Seeds ausdrücklich einspielen
#   ARCTOS_SKIP_PREDEPLOY_BACKUP=true    Backup überspringen (nicht empfohlen)
# ============================================================================

set -euo pipefail

cd /opt/arctos
COMPOSE_FILE="/opt/arctos/docker-compose.production.yml"
DEPLOY_LOG="/opt/arctos/deploy-history.jsonl"
ENV_FILE=/opt/arctos/.env

# #S13-04: ein Deploy, der auf halbem Weg abbricht, muss das SAGEN — und
# er muss sagen, wo das Pre-Deploy-Backup liegt.
DEPLOY_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PREDEPLOY_BACKUP_LABEL=""
PREVIOUS_IMAGE_TAG=""

deploy_record() {
  # $1 = status, $2 = detail
  printf '{"timestamp":"%s","startedAt":"%s","status":"%s","fromCommit":"%s","toCommit":"%s","preDeployBackup":"%s","previousImage":"%s","operator":"%s","detail":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$DEPLOY_STARTED_AT" "$1" \
    "${OLD_COMMIT:-unknown}" "${NEW_COMMIT:-unknown}" \
    "${PREDEPLOY_BACKUP_LABEL:-none}" "${PREVIOUS_IMAGE_TAG:-none}" \
    "${SUDO_USER:-${USER:-unknown}}" "${2//\"/\'}" \
    >> "$DEPLOY_LOG" 2>/dev/null || true
}

abort() {
  echo ""
  echo "============================================="
  echo "  DEPLOY ABGEBROCHEN"
  echo "  $1"
  echo "============================================="
  if [ -n "$PREDEPLOY_BACKUP_LABEL" ]; then
    echo "  Pre-Deploy-Backup: /opt/arctos/backups/*-${PREDEPLOY_BACKUP_LABEL}*"
    echo "  Rollback:          sudo bash /opt/arctos/deploy/rollback.sh --list"
  fi
  deploy_record "aborted" "$1"
  exit 1
}
trap 'rc=$?; [ $rc -ne 0 ] && deploy_record "failed" "unerwarteter Abbruch (Exit $rc)"; exit $rc' ERR

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

# ── 1c. Change-Control: lief CI fuer diesen Commit gruen? (#S13-19) ───────
# ADR-016 entscheidet bewusst gegen Auto-Deploy und begruendet das mit
# Change-Control. Der gewaehlte manuelle Pfad implementierte sie aber nicht:
# deployt wurde der Spitzenstand von `main`, ohne Tag, ohne Release, ohne
# Abfrage des CI-Status, ohne Signaturpruefung. Es gab keinen technischen
# Zusammenhang zwischen "CI war gruen" und "das laeuft in Produktion".
echo ""
echo "[1c/6] CI-Status von ${NEW_COMMIT:0:8} pruefen (#S13-19, ISO 27001 A.14.2.2)..."
if [ "${ARCTOS_ALLOW_UNVERIFIED_DEPLOY:-false}" = "true" ]; then
  echo "  UEBERSPRUNGEN: ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true."
  echo "  Diese Ausnahme steht im Deploy-Protokoll ($DEPLOY_LOG)."
  deploy_record "ci-check-skipped" "ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true"
elif ! command -v gh >/dev/null 2>&1; then
  abort "gh (GitHub CLI) ist nicht installiert — der CI-Status von ${NEW_COMMIT:0:8} ist nicht pruefbar.
  Installieren (\`apt-get install -y gh\` + \`gh auth login\`) oder den Deploy
  bewusst ohne Nachweis fahren: ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true"
else
  CI_CONCLUSION=$(gh run list --commit "$NEW_COMMIT" --workflow CI \
      --json conclusion,status --limit 1 --jq '.[0].conclusion // "none"' 2>/dev/null || echo "error")
  echo "  CI-Ergebnis: $CI_CONCLUSION"
  case "$CI_CONCLUSION" in
    success) echo "  OK — CI ist fuer diesen Commit gruen." ;;
    none)    abort "Fuer ${NEW_COMMIT:0:8} existiert kein CI-Lauf. Wurde der Commit gepusht?
  ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true umgeht die Pruefung bewusst." ;;
    error)   abort "CI-Status nicht abfragbar (gh auth?). ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true umgeht die Pruefung." ;;
    *)       abort "CI fuer ${NEW_COMMIT:0:8} ist '$CI_CONCLUSION', nicht 'success'.
  Ein Commit mit rotem CI gehoert nicht in Produktion (#S13-19)." ;;
  esac
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
echo "[1b/6] Env-Migration (neue Variablen sicherstellen)..."

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

# ── Neue PFLICHT-Variablen aus der Remediation 2026-08-31 ────────────────
# Ohne sie starten die Container bewusst nicht mehr (#S13-10). Sie werden
# hier erzeugt, damit ein bestehendes Deployment nicht am Update scheitert;
# der Wert ist danach in /opt/arctos/.env und gehoert in die Secret-Rotation.
#
# WICHTIG: AUDIT_SEAL_KEY und PII_PSEUDONYM_KEY sind NICHT beliebig
# rotierbar. Ein Wechsel des AUDIT_SEAL_KEY macht bestehende Ankersiegel
# unverifizierbar (WP4/S03-01); ein Wechsel des PII_PSEUDONYM_KEY trennt
# bestehende Pseudonyme von neuen (WP8/S07-03). Beide gehoeren deshalb ins
# Notfallhandbuch und in die Off-Host-Schluesselablage.
ensure_env_secret "GRC_WORKER_PASSWORD" "openssl rand -hex 24"   # WP2/S01-09
ensure_env_secret "AUDIT_SEAL_KEY"      "openssl rand -hex 32"   # WP4/S03-01
ensure_env_secret "PII_PSEUDONYM_KEY"   "openssl rand -hex 32"   # WP8/S07-03
ensure_env_hint   "AUDIT_SEAL_KEY_ID"   "Schluessel-ID der Ankersiegel (Default k1)"
ensure_env_hint   "WB_PSEUDONYM_KEY"    "HMAC der Melder-IP-Pseudonymisierung; ohne ihn aus WB_ENCRYPTION_KEY abgeleitet (WP8/S07-02)"
ensure_env_hint   "FREETSA_CA_PEM"      "CA-Kette zur Validierung der RFC-3161-Zeitstempel (WP4/S03-11)"
ensure_env_hint   "TRUSTED_PROXY_HOPS"  "Anzahl eigener Reverse-Proxys; bestimmt, welchem X-Forwarded-For-Eintrag geglaubt wird (WP9/S10-05). Default 1 = ein Caddy."

# ── 1d. PRE-DEPLOY-BACKUP (#S13-04a) ─────────────────────
# ADR-016:70-71 begruendet den manuellen Deploy ausdruecklich damit, dass
# DB-Migrationen nicht zurueckrollbar sind und "Pre-Migration-Backup
# (ADR-014) muss manuell gestartet werden". `db-backup.sh --pre-migration`
# existierte fuer genau diesen Zweck und wurde von hier NIE aufgerufen.
echo ""
echo "[1d/6] Pre-Deploy-Backup (#S13-04)..."
if [ "$OLD_COMMIT" = "$NEW_COMMIT" ] && [ "${ARCTOS_FORCE_UPDATE:-0}" != "1" ]; then
  echo "  Kein Codewechsel — Backup uebersprungen."
elif [ "${ARCTOS_SKIP_PREDEPLOY_BACKUP:-false}" = "true" ]; then
  echo "  UEBERSPRUNGEN: ARCTOS_SKIP_PREDEPLOY_BACKUP=true — im Protokoll vermerkt."
  deploy_record "backup-skipped" "ARCTOS_SKIP_PREDEPLOY_BACKUP=true"
else
  PREDEPLOY_BACKUP_LABEL="pre-migration"
  if bash /opt/arctos/deploy/db-backup.sh --pre-migration 2>&1 | sed 's/^/  /'; then
    echo "  Backup erfolgreich."
  else
    PREDEPLOY_BACKUP_LABEL=""
    abort "Das Pre-Deploy-Backup ist FEHLGESCHLAGEN. Ein Deploy ohne
  Rueckweg wird nicht gefahren: eine abgebrochene Migration liesse sonst
  bis zu 24 h Datenverlust zurueck (#S13-04a). Ursache beheben oder —
  bewusst und auf eigenes Risiko — ARCTOS_SKIP_PREDEPLOY_BACKUP=true."
  fi
fi

# Vorgaenger-Image fuer den Rollback festhalten (#S13-05b). Vorher existierte
# auf dem Host GAR KEIN Vorgaenger-Image: update-all.sh BAUT lokal und
# ueberschreibt dabei das Tag, auf das `image:` zeigt. Ein SHA-getaggtes
# Vorgaenger-Image lag nur in GHCR und wurde auf dem Host nie gepullt.
PREVIOUS_IMAGE_TAG="rollback-${OLD_COMMIT:0:12}"
for svc in web worker; do
  CUR_IMG=$(docker compose -f "$COMPOSE_FILE" images -q "$svc" 2>/dev/null | head -1)
  if [ -n "$CUR_IMG" ]; then
    docker tag "$CUR_IMG" "arctos-rollback/grc-${svc}:${OLD_COMMIT:0:12}" 2>/dev/null || true
    echo "  Rollback-Image gesichert: arctos-rollback/grc-${svc}:${OLD_COMMIT:0:12}"
  fi
done

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
# [#S13-04b, #S13-21]
#
# Hier stand eine Schleife, die JEDE Migrationsdatei per `psql` gegen JEDE
# Produktiv-DB fuhr — mit `>/dev/null 2>&1 || true`. Das hebelte das
# `set -euo pipefail` aus Zeile 15 fuer genau den kritischen Teil aus:
# jeder Migrationsfehler wurde vollstaendig und schweigend verworfen, nicht
# einmal gezaehlt. Zusaetzlich lief die Schleife mit `sort`
# (lexikografisch), waehrend der Entrypoint `sort -V` benutzte und CI eine
# dritte Variante fuhr — derselbe Satz Migrationen wurde in Produktion in
# einer ANDEREN Reihenfolge angewendet als in CI (#S13-21).
#
# Beides ist mit einem Schritt erledigt: der Runner aus WP1
# (`packages/db/src/migrate-all.ts`) ist inzwischen die EINE Quelle. Er
# fuehrt Buch in `_arctos_migrations` (SHA-256 je Datei), sortiert
# einheitlich, respektiert die Transaktionssteuerung der Dateien und endet
# mit Exit != 0, wenn eine Migration fehlschlaegt. Er laeuft im
# worker-Container, weil dessen Image die Quellen und `tsx` mitbringt.
#
# Folge fuer S13-21: der Entrypoint der neu gestarteten Container findet
# dieselben Migrationen bereits verbucht vor und wendet sie nicht erneut an.
echo ""
echo "[3/6] Migrationen anwenden (Ledger-Runner, Fehler brechen ab)..."

MIGRATE_DBS=(grc_platform)
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    MIGRATE_DBS+=("grc_$(basename "$tdir")")
  done
fi

DB_PASSWORD_VALUE=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
[ -n "$DB_PASSWORD_VALUE" ] || abort "DB_PASSWORD fehlt in $ENV_FILE — Migrationen nicht ausfuehrbar."

for DB_NAME in "${MIGRATE_DBS[@]}"; do
  echo "  DB: $DB_NAME"
  if ! docker compose -f "$COMPOSE_FILE" exec -T \
        -e DATABASE_URL="postgresql://grc:${DB_PASSWORD_VALUE}@postgres:5432/${DB_NAME}" \
        worker sh -c 'cd /app && npx tsx packages/db/src/migrate-all.ts' 2>&1 | sed 's/^/    /'; then
    abort "Migration auf $DB_NAME FEHLGESCHLAGEN.
  Der Ledger (_arctos_migrations) haelt fest, was angewendet wurde; die
  Fehlermeldung steht oben. Vor 2026-08-31 wurde genau dieser Fehler
  verschluckt und der Deploy meldete Erfolg (#S13-04b).
  Pre-Deploy-Backup: /opt/arctos/backups/*-${PREDEPLOY_BACKUP_LABEL:-pre-migration}*
  Rollback:          sudo bash /opt/arctos/deploy/rollback.sh --list"
  fi
done

# ── 3b. Katalog-Baseline-Top-up (idempotent) ──────────────
# Alle Kataloge sind scope='platform'. Ältere Tenants (vor Einführung
# des Katalog-Seeders in create-tenant.sh) haben keine Frameworks.
# Die Seeds sind via ON CONFLICT DO NOTHING idempotent → einfach neu
# einspielen, bereits vorhandene Rows werden übersprungen.
echo ""
echo "[3b/6] Katalog-Baseline top-up (idempotent, alle DBs)..."
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
echo "[3c/6] Wave-21+22 Reference-Seed-Top-up..."

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
# Programme-Templates sind Reference-Data (Normvorlagen), kein Demo-Inhalt —
# sie bleiben unbedingt. Nur die beiden seed_demo_*-Dateien sind gegated.
echo "  → programme-templates (TS seeder via worker, Main-DB only)"
docker compose -f "$COMPOSE_FILE" exec -T worker \
  sh -c "cd /app && npx tsx packages/db/src/seeds/run-programme-templates.ts" 2>&1 \
  | sed 's/^/    /' || echo "    (Seeder-Fehler — manuell prüfen)"

# ── #S13-20: DEMO-SEEDS NUR MIT AUSDRUECKLICHER ZUSTIMMUNG ─────────────
# Beide Demo-Seeds liefen hier UNBEDINGT bei jedem Produktions-Update gegen
# die Haupt-DB `grc_platform` — ohne Abfrage von SEED_DEMO_DATA, NODE_ENV
# oder ALLOW_DEMO_SEED_IN_PROD. Der Deploy-Pfad umging damit genau die
# Schutzmassnahme, die fuer denselben Zweck im Entrypoint eingebaut ist
# (#SEC-F04, docker-entrypoint.sh:71-77).
#
# Wirkung: die produktive Haupt-DB enthielt dauerhaft Demo-Fachdaten
# ("ISO 27001 Cert 2026", "DSGVO Roadmap", Meridian-Demo-Org), die in
# Reports, Dashboards, KRI-Aggregaten und AI-Retrieval mitgezaehlt wurden.
# In einem Produkt, dessen Ausgaben als Compliance-Nachweis dienen, ist die
# Vermischung von Demo- und Echtdaten ein Integritaetsdefekt.
# `seed_demo_14` schreibt laut eigenem Kommentar zusaetzlich in die
# Hash-Kette.
if [ "${ALLOW_DEMO_SEED_IN_PROD:-false}" != "true" ]; then
  echo "  → Demo-Seeds UEBERSPRUNGEN (#S13-20)."
  echo "    seed_demo_13_programmes.sql und seed_demo_14_july_features.sql"
  echo "    schreiben Demo-Fachdaten in die produktive Haupt-DB. Nur mit"
  echo "    ALLOW_DEMO_SEED_IN_PROD=true einspielen — und nur auf einer"
  echo "    Demo-Instanz."
else
  echo "  → ACHTUNG: ALLOW_DEMO_SEED_IN_PROD=true — Demo-Seeds werden eingespielt."
  deploy_record "demo-seed" "ALLOW_DEMO_SEED_IN_PROD=true — Demo-Daten in grc_platform"

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
fi  # Ende ALLOW_DEMO_SEED_IN_PROD (#S13-20)

# ── 3d. grc_app-Rolle provisionieren (#SEC-F01) ───────────
# Nach den Migrationen (Tabellen existieren) und VOR dem Container-Restart:
# die Nicht-Superuser-Rolle grc_app anlegen/aktualisieren und Least-Privilege-
# Grants auf alle DBs setzen. Erst danach dürfen web+worker mit
# APP_DATABASE_URL=grc_app neu starten. ALTER DEFAULT PRIVILEGES deckt künftige
# Tabellen ab. Schließt zugleich #SEC-F09 (FORCE RLS auf organization).
# [#S13-04d] Fehler waren hier FOLGENLOS: schlug die Provisionierung fehl,
# wurde "WARNUNG:" gedruckt und die Container trotzdem mit
# APP_DATABASE_URL=grc_app:… neu gestartet — die App konnte sich dann nicht
# verbinden. Fehlte GRC_APP_PASSWORD, wurde die Rolle gar nicht angelegt,
# ebenfalls nur mit Warnung. Beides bricht jetzt ab.
#
# Zusaetzlich (WP2/S01-09, WP9): die Rolle `grc_worker` wird mit angelegt.
# Ohne sie startet der Worker-Container nicht mehr — das ist Absicht, muss
# aber im Deploy-Weg passieren, nicht im Kopf des Operators.
echo ""
echo "[3d/6] Laufzeitrollen provisionieren (grc_app + grc_worker)..."
GRC_APP_PW=$(grep -E '^GRC_APP_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
GRC_WORKER_PW=$(grep -E '^GRC_WORKER_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
PROVISION=/opt/arctos/deploy/provision-grc-app.sh
[ -n "$GRC_APP_PW" ] || abort "GRC_APP_PASSWORD fehlt in $ENV_FILE.
  Ohne die Nicht-Superuser-Rolle grc_app laeuft die Anwendung als Superuser
  und saemtliche RLS-Policies sind wirkungslos (#S13-09/#S13-10). Der
  Env-Migrationsschritt [1b] erzeugt den Wert normalerweise selbst."
[ -n "$GRC_WORKER_PW" ] || abort "GRC_WORKER_PASSWORD fehlt in $ENV_FILE.
  Der Worker verbindet seit der Remediation als grc_worker (BYPASSRLS, kein
  SUPERUSER, WP2/S01-09) und startet ohne die Variable nicht."
[ -f "$PROVISION" ] || abort "$PROVISION fehlt — Laufzeitrollen nicht provisionierbar."

chmod +x "$PROVISION" 2>/dev/null || true
PROV_DBS=(grc_platform)
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    PROV_DBS+=("grc_$(basename "$tdir")")
  done
fi
if ! GRC_APP_PASSWORD="$GRC_APP_PW" GRC_WORKER_PASSWORD="$GRC_WORKER_PW" \
     COMPOSE_FILE="$COMPOSE_FILE" bash "$PROVISION" "${PROV_DBS[@]}" 2>&1 | sed 's/^/  /'; then
  abort "provision-grc-app.sh ist fehlgeschlagen. Ein Neustart der Container
  mit APP_DATABASE_URL=grc_app waere danach ein Deploy in einen
  Verbindungsfehler (#S13-04d)."
fi

# ── 4. Haupt-Container neu starten (web + worker) ─────────
echo ""
echo "[4/6] Haupt-Container neu starten (web + worker)..."
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

# ── #S13-22 / #S13-13: auf "healthy" WARTEN statt auf "running" schauen ──
# `--force-recreate` stoppt und startet; es gibt keine zweite Replik und
# damit kein echtes Zero-Downtime (das braucht zwei Repliken hinter Caddy —
# als Betreiber-Punkt in docs/runbook.md §6 dokumentiert). Was hier
# hergestellt wird, ist ein GESTEUERTES Fenster: beide Container haben seit
# der Remediation einen HEALTHCHECK (#S13-13), und der Deploy wartet auf
# ihn, statt nach 5 Sekunden "running" zu sehen und weiterzugehen. Ein
# haengender Node-Prozess ist "running" und trotzdem tot.
wait_healthy() {
  local svc="$1" timeout="${2:-300}" waited=0 cid state health
  cid=$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" 2>/dev/null | head -1)
  if [ -z "$cid" ]; then echo "  FEHLER: Container fuer '$svc' existiert nicht."; return 1; fi
  while [ "$waited" -lt "$timeout" ]; do
    state=$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)
    case "$state:$health" in
      running:healthy) echo "  $svc: healthy nach ${waited}s"; return 0 ;;
      running:none)
        # Image ohne HEALTHCHECK (aelteres Image im Umlauf) — dann bleibt
        # nur "running", und das wird ausdruecklich als schwaechere Aussage
        # protokolliert.
        sleep 10; waited=$((waited + 10))
        if [ "$waited" -ge 30 ]; then
          echo "  $svc: laeuft, aber das Image hat keinen HEALTHCHECK —"
          echo "         schwaechere Aussage als 'healthy' (#S13-13)."
          return 0
        fi ;;
      exited:*|dead:*)
        echo "  $svc: Status '$state' — Container ist beendet."; return 1 ;;
      *:unhealthy)
        echo "  $svc: HEALTHCHECK meldet 'unhealthy'."; return 1 ;;
      *) sleep 5; waited=$((waited + 5)) ;;
    esac
  done
  echo "  $svc: nach ${timeout}s weder healthy noch beendet (Status $state/$health)."
  return 1
}

DEPLOY_UNHEALTHY=0
for svc in web worker; do
  if ! wait_healthy "$svc" 300; then
    DEPLOY_UNHEALTHY=1
    echo "  Letzte Logs ($svc):"
    docker compose -f "$COMPOSE_FILE" logs --tail=40 "$svc" 2>&1 | sed 's/^/    /'
  fi
done

if [ "$DEPLOY_UNHEALTHY" = "1" ]; then
  echo ""
  echo "  Haupt-Container sind nach dem Update NICHT gesund — Rollback auf"
  echo "  das Vorgaenger-Image ${OLD_COMMIT:0:12} wird versucht (#S13-05)."
  if bash /opt/arctos/deploy/rollback.sh --image "${OLD_COMMIT:0:12}" 2>&1 | sed 's/^/    /'; then
    abort "Update fehlgeschlagen, Image-Rollback auf ${OLD_COMMIT:0:12} durchgefuehrt.
  Die DATENBANK ist NICHT zurueckgerollt — Migrationen laufen vorwaerts.
  Wenn die Migration die Ursache war: sudo bash deploy/rollback.sh --db --list"
  else
    abort "Update fehlgeschlagen UND der Image-Rollback ist fehlgeschlagen.
  Sofort: sudo bash /opt/arctos/deploy/rollback.sh --list"
  fi
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
echo "[4b/6] Tenant-Worker-Service sicherstellen (idempotent)..."
HELPER=/opt/arctos/deploy/ensure-tenant-worker.sh
if [ -f "$HELPER" ]; then
  chmod +x "$HELPER" 2>/dev/null || true
  bash "$HELPER" 2>&1 | sed 's/^/  /' || true
else
  echo "  WARNUNG: $HELPER fehlt — bestehende Tenants bekommen keinen Worker"
fi

# ── 5. Alle Tenant-Container neu starten ─────────────────
echo ""
echo "[5/6] Tenant-Container neu starten (web + worker)..."
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

# ── 6. Health-Gate (#S13-04c) ─────────────────────────────
# Hier wurde `$CODE` ausgegeben und NIE verglichen. Ein Deploy, nach dem
# die Anwendung HTTP 500 lieferte, endete mit
#   main (127.0.0.1:3000)   HTTP 500
#   Update abgeschlossen: <sha>
# und Exit-Code 0. Der Operator sah eine Erfolgsmeldung.
echo ""
echo "[6/6] Health-Gate..."
sleep 5

HEALTH_FAILED=0

check_endpoint() {
  # $1 = Beschriftung, $2 = URL, $3 = erwarteter Statuscode
  local label="$1" url="$2" want="${3:-200}" code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  printf "  %-42s HTTP %s (erwartet %s)\n" "$label" "$code" "$want"
  if [ "$code" != "$want" ]; then
    HEALTH_FAILED=$((HEALTH_FAILED + 1))
    return 1
  fi
  return 0
}

# Main: /api/v1/health ist die Aussage ueber die Anwendung, /login nur die
# ueber den HTTP-Server.
check_endpoint "main /api/v1/health" "http://127.0.0.1:3000/api/v1/health" 200 || true
check_endpoint "main /login"         "http://127.0.0.1:3000/login"         200 || true

# Tenants
if [ -d /opt/arctos/tenants ]; then
  for tdir in /opt/arctos/tenants/*/; do
    [ -d "$tdir" ] || continue
    TENANT=$(basename "$tdir")
    PORT=$(cd "$tdir" && docker compose ps --format json 2>/dev/null | grep -oP '"Publishers":\[\{[^}]*"PublishedPort":\K[0-9]+' | head -1)
    if [ -n "$PORT" ]; then
      check_endpoint "$TENANT /api/v1/health" "http://127.0.0.1:$PORT/api/v1/health" 200 || true
    else
      echo "  WARNUNG: Port fuer Tenant $TENANT nicht ermittelbar — nicht geprueft."
      HEALTH_FAILED=$((HEALTH_FAILED + 1))
    fi
  done
fi

# Schema-Drift nach der Migration (ADR-014-Deploy-Gate). Der Endpunkt ist
# admin-authentifiziert; ohne Cookie liefert er 401 — das ist trotzdem eine
# Aussage (der Router lebt). Der inhaltliche Abgleich gehoert ins Monitoring
# (scripts/ops-metrics.mjs).
DRIFT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "http://127.0.0.1:3000/api/v1/health/schema-drift" 2>/dev/null || echo "000")
printf "  %-42s HTTP %s\n" "main /health/schema-drift (401 = ok)" "$DRIFT_CODE"

if [ "$HEALTH_FAILED" -gt 0 ]; then
  echo ""
  echo "  $HEALTH_FAILED Health-Pruefung(en) fehlgeschlagen."
  echo "  Rollback auf das Vorgaenger-Image ${OLD_COMMIT:0:12} wird versucht."
  bash /opt/arctos/deploy/rollback.sh --image "${OLD_COMMIT:0:12}" 2>&1 | sed 's/^/    /' || true
  abort "Deploy nach dem Neustart nicht gesund ($HEALTH_FAILED Pruefungen rot).
  Vor 2026-08-31 endete genau dieser Fall mit 'Update abgeschlossen' und
  Exit 0 (#S13-04c)."
fi

deploy_record "success" "$NEW_COMMIT deployed, alle Health-Pruefungen gruen"

echo ""
echo "============================================="
echo "  Update abgeschlossen: $NEW_COMMIT"
echo "  Alle Health-Pruefungen gruen."
echo "  Protokoll: $DEPLOY_LOG"
if [ -n "$PREDEPLOY_BACKUP_LABEL" ]; then
  echo "  Pre-Deploy-Backup: /opt/arctos/backups/*-${PREDEPLOY_BACKUP_LABEL}*"
fi
echo "  Rollback:  sudo bash /opt/arctos/deploy/rollback.sh --list"
echo "============================================="
