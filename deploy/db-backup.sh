#!/bin/bash
# ============================================================================
# ARCTOS — Backup (Datenbanken + DMS-Objektspeicher)
#
# [ARCTOS-FULL-2026-08-31 / WP10 · S13-06, S13-07, S13-24]
#
# Was sich gegenüber der Fassung vom 2026-08-31 geändert hat und warum:
#
#  * S13-06 — DER OBJEKTSPEICHER WAR IN KEINEM BACKUP. Gesichert wurde
#    ausschliesslich `pg_dump` aller `^grc_`-Datenbanken, also allein das
#    Volume `pgdata`. Die DMS-Dateien liegen je nach STORAGE_BACKEND im
#    Volume `uploads` (local) oder in `garagedata`/`garagemeta` (s3) —
#    beides unbackuped. Nach einem Host-Verlust standen in der Datenbank
#    die `document`-Zeilen mit SHA-256-Hashes, Signaturketten und
#    Aufbewahrungsfristen, und die Dateien selbst waren weg: die Hash-Kette
#    hätte nur noch bewiesen, dass ein nicht mehr vorhandenes Dokument
#    einmal existierte. Für ein Produkt, das Dokumentenintegrität nach
#    eIDAS bewirbt, ist das der Verlust genau der Artefakte, um die es geht.
#    → `--with-objects` (Standard AN) sichert die Volumes mit.
#
#  * S13-07 — BACKUPS LAGEN UNVERSCHLÜSSELT. ADR-015 §1 sagt
#    GPG-symmetrische Verschlüsselung mit einem Schlüssel unter
#    `/opt/arctos/.rclone.key` zu; implementiert war davon nichts, weder
#    lokal noch beim Off-Site-Sync nach Backblaze B2. Ein Dump enthält
#    `whistleblowing`-Identitäten (HinSchG §8), `dpms`-Vorfalldaten
#    (Art.-9-DSGVO-Kategorien), Passwort-Hashes und Connector-Secrets.
#    → Jeder Dump wird jetzt mit GPG/AES-256 symmetrisch verschlüsselt,
#      sobald `$BACKUP_KEY_FILE` existiert. Der Off-Site-Sync überträgt
#      damit nur noch Chiffrate. `BACKUP_ALLOW_PLAINTEXT=1` erlaubt den
#      alten Zustand ausdrücklich — laut, sichtbar und begründungspflichtig.
#
#  * S13-24 — RETENTION WAR AN DREI STELLEN WIDERSPRÜCHLICH: dieses Skript
#    löschte > 30 Tage, das von `backup-cron-install.sh` erzeugte
#    `backup-rotate.sh` > 14 Tage, `runbook.md` sagte an einer Stelle 30
#    und an anderer 14. Effektiv galt 14, während zwei Dokumente 30
#    zusagten. → EINE Quelle: `BACKUP_RETENTION_DAYS` (Standard 30), von
#    beiden Skripten und der Doku gelesen.
#
# Verwendung auf dem Hetzner-Host:
#   sudo bash deploy/db-backup.sh                   # alle DBs + Objektspeicher
#   sudo bash deploy/db-backup.sh grc_daimon        # nur eine DB
#   sudo bash deploy/db-backup.sh --pre-migration   # wie "alle", mit Markierung
#   sudo bash deploy/db-backup.sh --no-objects      # nur Datenbanken
#
# Wiederherstellung: siehe deploy/restore.sh und docs/dr-playbook.md.
# ============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/arctos/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/arctos/docker-compose.production.yml}"
PG_SERVICE="postgres"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
# #S13-24: die EINE Quelle der Aufbewahrungsfrist.
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
# #S13-07: symmetrischer Backup-Schlüssel. Ausserhalb des Repos, ausserhalb
# jedes Images, root-lesbar (0400). Angelegt von backup-cron-install.sh.
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:-/opt/arctos/.backup.key}"
WITH_OBJECTS=1
LABEL=""
TARGET_DB=""

while [ $# -gt 0 ]; do
  case "$1" in
    ""|--all)         ;;
    --pre-migration)  LABEL="pre-migration" ;;
    --no-objects)     WITH_OBJECTS=0 ;;
    --with-objects)   WITH_OBJECTS=1 ;;
    --*)              LABEL="${1#--}" ;;
    *)                TARGET_DB="$1" ;;
  esac
  shift
done

mkdir -p "$BACKUP_DIR"

echo "============================================="
echo "  ARCTOS — Backup"
echo "============================================="
echo "  Timestamp:   $TIMESTAMP"
echo "  Target:      ${TARGET_DB:-<alle grc_*-DBs>}"
echo "  Label:       ${LABEL:-<keins>}"
echo "  Objekte:     $([ "$WITH_OBJECTS" = "1" ] && echo "ja (DMS-Volumes)" || echo "nein (--no-objects)")"
echo "  Retention:   ${BACKUP_RETENTION_DAYS} Tage"
echo "  Zielpfad:    $BACKUP_DIR"

# ── Verschlüsselung feststellen (#S13-07) ─────────────────────────────────
ENCRYPT=0
if [ -f "$BACKUP_KEY_FILE" ]; then
  if command -v gpg >/dev/null 2>&1; then
    ENCRYPT=1
    echo "  Verschlüsselung: GPG/AES-256 symmetrisch (Schlüssel: $BACKUP_KEY_FILE)"
  else
    echo "FEHLER: $BACKUP_KEY_FILE existiert, aber gpg ist nicht installiert." >&2
    echo "        \`apt-get install -y gnupg\` — oder BACKUP_ALLOW_PLAINTEXT=1 setzen." >&2
    [ "${BACKUP_ALLOW_PLAINTEXT:-0}" = "1" ] || exit 1
  fi
fi
if [ "$ENCRYPT" = "0" ]; then
  if [ "${BACKUP_ALLOW_PLAINTEXT:-0}" != "1" ]; then
    cat >&2 <<'EOF'

FEHLER: Es gibt keinen Backup-Schlüssel — die Dumps blieben unverschlüsselt.

  Ein Dump enthält Hinweisgeber-Identitäten (HinSchG §8), DPMS-Vorfalldaten
  (Art.-9-DSGVO-Kategorien), Passwort-Hashes und verschlüsselte
  Connector-Secrets. ADR-015 §1 sagt Verschlüsselung zu; bis zum Audit
  2026-08-31 war sie nicht implementiert (#S13-07).

  Schlüssel anlegen (einmalig, als root):
      umask 077
      openssl rand -base64 48 > /opt/arctos/.backup.key
      chmod 0400 /opt/arctos/.backup.key

  DANACH SOFORT eine Kopie AUSSERHALB dieses Hosts ablegen (Passwort-Safe,
  versiegelter Umschlag). Ohne den Schlüssel ist KEIN Backup wiederherstellbar
  — das ist der Preis der Verschlüsselung und gehört ins Notfallhandbuch.

  Bewusst unverschlüsselt sichern (nicht empfohlen):
      BACKUP_ALLOW_PLAINTEXT=1 bash deploy/db-backup.sh

EOF
    exit 1
  fi
  echo "  Verschlüsselung: NEIN (BACKUP_ALLOW_PLAINTEXT=1) — siehe #S13-07"
fi
echo ""

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "FEHLER: $COMPOSE_FILE nicht gefunden."
  exit 1
fi

# `gpg --symmetric` liest den Schlüssel aus einer Datei; kein Passwort auf der
# Kommandozeile, damit es nicht in /proc/<pid>/cmdline sichtbar wird.
encrypt_stream() {
  gpg --batch --yes --quiet --symmetric --cipher-algo AES256 \
      --s2k-digest-algo SHA512 --compress-algo none \
      --passphrase-file "$BACKUP_KEY_FILE" --pinentry-mode loopback
}

# ── 1. DB-Liste bestimmen ─────────────────────────────────────────
if [ -n "$TARGET_DB" ]; then
  DB_LIST="$TARGET_DB"
else
  echo "[1/4] DB-Liste ermitteln..."
  DB_LIST=$(
    docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
      psql -U grc -d postgres -tAc \
      "SELECT datname FROM pg_database WHERE datname ~ '^grc_' ORDER BY datname;"
  )
  if [ -z "$DB_LIST" ]; then
    echo "FEHLER: Keine Tenant-DBs gefunden (kein Datenbankname mit Präfix 'grc_')."
    exit 1
  fi
  echo "  Gefundene DBs:"
  echo "$DB_LIST" | sed 's/^/    /'
fi

# ── 2. Pro DB: Dump + Checksumme (+ Verschlüsselung) ──────────────
echo ""
echo "[2/4] Datenbank-Dumps erzeugen..."
TOTAL_OK=0
TOTAL_FAIL=0
for DB in $DB_LIST; do
  DB=$(echo "$DB" | xargs)
  [ -z "$DB" ] && continue
  SUFFIX="${LABEL:+-$LABEL}"
  BASE="$BACKUP_DIR/${DB}-${TIMESTAMP}${SUFFIX}"
  EXT=".dump"
  [ "$ENCRYPT" = "1" ] && EXT=".dump.gpg"

  echo "  → $DB"

  # Custom-Format (für pg_restore, kleinste Dateigröße, parallelisierbar).
  # #S13-07: `set -o pipefail` gilt global, ein Fehler in pg_dump ODER gpg
  # bricht den Zweig ab und die Teildatei wird entfernt.
  if [ "$ENCRYPT" = "1" ]; then
    DUMP_OK=0
    docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
      pg_dump -U grc --format=custom --compress=6 --no-owner --no-privileges "$DB" \
      | encrypt_stream > "${BASE}${EXT}" && DUMP_OK=1
  else
    DUMP_OK=0
    docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
      pg_dump -U grc --format=custom --compress=6 --no-owner --no-privileges "$DB" \
      > "${BASE}${EXT}" && DUMP_OK=1
  fi

  if [ "$DUMP_OK" = "1" ] && [ -s "${BASE}${EXT}" ]; then
    DUMP_SIZE=$(du -h "${BASE}${EXT}" | cut -f1)
    echo "      Dump:          ${BASE}${EXT} ($DUMP_SIZE)"
    # SHA-256 über die Datei, wie sie abgelegt wird (also über das
    # Chiffrat) — genau das prüft der Off-Site-Sync nach der Übertragung.
    sha256sum "${BASE}${EXT}" > "${BASE}${EXT}.sha256"
    TOTAL_OK=$((TOTAL_OK + 1))
  else
    echo "      FEHLER beim Dump von $DB."
    rm -f "${BASE}${EXT}" "${BASE}${EXT}.sha256" 2>/dev/null || true
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
done

# ── 3. DMS-Objektspeicher (#S13-06) ───────────────────────────────
echo ""
if [ "$WITH_OBJECTS" = "1" ] && [ -z "$TARGET_DB" ]; then
  echo "[3/4] DMS-Objektspeicher sichern (#S13-06)..."
  # Die Volumes heissen <projekt>_<name>. Das Projekt ist der Verzeichnisname
  # von COMPOSE_FILE, sofern COMPOSE_PROJECT_NAME nichts anderes sagt.
  PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$(dirname "$COMPOSE_FILE")")}"
  OBJ_BASE="$BACKUP_DIR/objects-${TIMESTAMP}${LABEL:+-$LABEL}"
  OBJ_EXT=".tar.gz"
  [ "$ENCRYPT" = "1" ] && OBJ_EXT=".tar.gz.gpg"

  # Alle Volumes, die Nutzdaten tragen. `miniodata` bleibt in der Liste,
  # solange die Garage-Migration nicht überall abgeschlossen ist
  # (deploy/MINIO-TO-GARAGE-MIGRATION.md) — ein leeres Volume kostet nichts,
  # ein vergessenes kostet die Dokumente.
  OBJ_VOLUMES="uploads branding garagedata garagemeta miniodata"
  FOUND=""
  for v in $OBJ_VOLUMES; do
    if docker volume inspect "${PROJECT}_${v}" >/dev/null 2>&1; then
      FOUND="$FOUND ${v}"
    fi
  done

  if [ -z "$FOUND" ]; then
    echo "  WARNUNG: kein DMS-Volume gefunden (Projekt '${PROJECT}')."
    echo "  Erwartet: ${OBJ_VOLUMES}. Ohne sie sind die signierten Dokumente"
    echo "  NICHT gesichert (#S13-06). COMPOSE_PROJECT_NAME prüfen."
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  else
    echo "  Volumes:${FOUND}"
    MOUNTS=""
    for v in $FOUND; do
      MOUNTS="$MOUNTS -v ${PROJECT}_${v}:/vol/${v}:ro"
    done
    OBJ_OK=0
    # shellcheck disable=SC2086
    if [ "$ENCRYPT" = "1" ]; then
      docker run --rm $MOUNTS alpine:3 \
        sh -c 'cd /vol && tar -cf - . 2>/dev/null' \
        | gzip -6 | encrypt_stream > "${OBJ_BASE}${OBJ_EXT}" && OBJ_OK=1
    else
      docker run --rm $MOUNTS alpine:3 \
        sh -c 'cd /vol && tar -cf - . 2>/dev/null' \
        | gzip -6 > "${OBJ_BASE}${OBJ_EXT}" && OBJ_OK=1
    fi
    if [ "$OBJ_OK" = "1" ] && [ -s "${OBJ_BASE}${OBJ_EXT}" ]; then
      echo "      Objekte:       ${OBJ_BASE}${OBJ_EXT} ($(du -h "${OBJ_BASE}${OBJ_EXT}" | cut -f1))"
      sha256sum "${OBJ_BASE}${OBJ_EXT}" > "${OBJ_BASE}${OBJ_EXT}.sha256"
      TOTAL_OK=$((TOTAL_OK + 1))
    else
      echo "      FEHLER beim Sichern des Objektspeichers."
      rm -f "${OBJ_BASE}${OBJ_EXT}" "${OBJ_BASE}${OBJ_EXT}.sha256" 2>/dev/null || true
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
  fi
else
  echo "[3/4] Objektspeicher übersprungen ($([ -n "$TARGET_DB" ] && echo "Einzel-DB" || echo "--no-objects"))."
fi

# ── 4. Rotation (#S13-24: eine Quelle der Aufbewahrungsfrist) ─────
echo ""
echo "[4/4] Alte Backups (> ${BACKUP_RETENTION_DAYS} Tage) aufraeumen..."
OLD_COUNT=$(find "$BACKUP_DIR" -type f \
  \( -name "*.dump" -o -name "*.dump.gpg" -o -name "*.sql.gz" \
     -o -name "*.tar.gz" -o -name "*.tar.gz.gpg" -o -name "*.sha256" \) \
  -mtime "+${BACKUP_RETENTION_DAYS}" 2>/dev/null | wc -l)
if [ "$OLD_COUNT" -gt 0 ]; then
  find "$BACKUP_DIR" -type f \
    \( -name "*.dump" -o -name "*.dump.gpg" -o -name "*.sql.gz" \
       -o -name "*.tar.gz" -o -name "*.tar.gz.gpg" -o -name "*.sha256" \) \
    -mtime "+${BACKUP_RETENTION_DAYS}" -delete
  echo "  $OLD_COUNT alte Dateien geloescht."
else
  echo "  Keine alten Dateien zu loeschen."
fi

# ── Ergebnis + maschinenlesbarer Stempel (#S13-12) ────────────────
echo ""
echo "============================================="
echo "  Fertig: $TOTAL_OK erfolgreich, $TOTAL_FAIL fehlgeschlagen"
echo "  Speicherort: $BACKUP_DIR"
echo "============================================="

STATUS="ok"
[ "$TOTAL_FAIL" -gt 0 ] && STATUS="failed"
# Der Stempel wird von scripts/ops-metrics.mjs gelesen und als
# `arctos_backup_age_seconds` / `arctos_backup_last_status` exportiert.
# Vorher schrieb backup-cron-install.sh zwar einen `.last-run`-Stempel,
# aber nichts las ihn je (#S13-12).
printf '{"timestamp":"%s","status":"%s","ok":%d,"failed":%d,"encrypted":%s,"objects":%s,"retentionDays":%d}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$STATUS" "$TOTAL_OK" "$TOTAL_FAIL" \
  "$([ "$ENCRYPT" = "1" ] && echo true || echo false)" \
  "$([ "$WITH_OBJECTS" = "1" ] && echo true || echo false)" \
  "$BACKUP_RETENTION_DAYS" \
  > "$BACKUP_DIR/.last-run.json"

if [ "$TOTAL_FAIL" -gt 0 ]; then
  exit 2
fi
