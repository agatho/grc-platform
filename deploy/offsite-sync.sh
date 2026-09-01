#!/bin/bash
# ============================================================================
# ARCTOS — Off-Site Backup Sync via rclone -> Backblaze B2
#
# [ARCTOS-FULL-2026-08-31 / WP10 · S13-07, S13-23, S13-05(e)]
#
# Was sich geändert hat und warum:
#
#  * S13-07 — DIE ÜBERTRAGUNG WAR UNVERSCHLÜSSELT. ADR-015 §1 sagte
#    "rclone nutzt --password-command mit GPG-symmetric" zu, das
#    ADR-Diagramm beschriftete den Pfad mit "encrypted", und die
#    Alternativenbewertung rechtfertigte B2 mit "verschlüsselte Dumps →
#    minimal". Implementiert war ein nacktes `rclone copyto` gegen ein
#    `type = b2`-Remote; `/opt/arctos/.rclone.key` wurde von keinem Skript
#    je erzeugt oder gelesen. Ein Leak des B2-Keys (er liegt in
#    `$HOME/.config/rclone/rclone.conf` auf DEMSELBEN Host wie die
#    Anwendung) hätte vollständige `pg_dump`-Kopien ALLER Mandanten
#    preisgegeben: Hinweisgeber-Identitäten, DPMS-Vorfalldaten,
#    Passwort-Hashes.
#    → Die Verschlüsselung liegt jetzt bei der QUELLE: `db-backup.sh`
#      schreibt `.dump.gpg` / `.tar.gz.gpg`. Dieses Skript überträgt nur
#      noch, was verschlüsselt ist, und WEIGERT SICH, Klartext-Dumps
#      hochzuladen (`OFFSITE_ALLOW_PLAINTEXT=1` als ausdrückliche,
#      protokollierte Ausnahme). Damit ist auch das LOKALE Backup
#      geschützt — was eine reine Transport-Verschlüsselung nie geleistet
#      hätte.
#
#  * S13-23(c) — FEHLER BEENDETEN DAS SKRIPT MIT EXIT 0. Schlugen alle
#    Uploads fehl (abgelaufener Key, B2-Ausfall, volles Bucket), endete
#    der Lauf mit `"uploaded":0` und Exit 0. Cron meldete Erfolg, niemand
#    las `/var/log/arctos-offsite.log` — das Off-Site-Backup konnte Monate
#    tot sein, ohne dass es auffiel. → Exit 2 bei fehlgeschlagenem Upload,
#    Exit 3, wenn gar nichts zu übertragen war.
#
#  * S13-23(d) — Die von ADR-015:92 vorgesehene Alterungsmetrik
#    `arctos_offsite_backup_age_seconds` war nicht implementiert. → Der
#    Lauf schreibt `$BACKUP_DIR/.offsite-last-run.json`;
#    `scripts/ops-metrics.mjs` exportiert daraus die Metrik.
#
#  * S13-05(e) — `dr-playbook.md:80` rief `offsite-sync.sh --download latest`
#    auf. Das Skript wertete KEIN EINZIGES Argument aus; der Download-Pfad
#    aus B2 im Host-Ausfall-Szenario war nicht implementiert — also genau
#    die Prozedur, auf die es im Katastrophenfall ankommt.
#    → `--download <latest|DATEINAME> [--dest DIR]` ist implementiert und
#      prüft die Checksumme nach dem Herunterladen. `--list` zeigt den
#      Bestand.
#
# Voraussetzungen:
#   - rclone installiert (apt install rclone)
#   - Remote "b2-arctos" konfiguriert (deploy/offsite-sync-setup.sh)
#   - B2-Application-Key mit writeFiles, OHNE deleteFiles (Append-only)
#
# Aufruf via cron — NACH db-backup.sh (#S13-23b): backup-cron-install.sh
# installiert beides in EINER verketteten Zeile in der richtigen Reihenfolge.
# ============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/arctos/backups}"
B2_REMOTE="${B2_REMOTE:-b2-arctos:arctos-backups}"
LOG_FILE="${OFFSITE_LOG_FILE:-/var/log/arctos-offsite.log}"
MAX_AGE_HOURS="${OFFSITE_MAX_AGE_HOURS:-48}"

log_json() { echo "$1" >> "$LOG_FILE"; }
die() {
  log_json "{\"timestamp\":\"$(date -u -Iseconds)\",\"error\":\"$1\"}"
  echo "FEHLER: $1" >&2
  exit "${2:-1}"
}

command -v rclone >/dev/null 2>&1 || die "rclone not installed" 1

# ── Modus: --list / --download (#S13-05e) ─────────────────────────────────
MODE="sync"
DL_WHAT=""
DL_DEST="${BACKUP_DIR}/restore"
while [ $# -gt 0 ]; do
  case "$1" in
    --list)     MODE="list" ;;
    --download) MODE="download"; DL_WHAT="${2:-latest}"; shift ;;
    --dest)     DL_DEST="${2:?--dest braucht ein Verzeichnis}"; shift ;;
    --help|-h)  sed -n '1,60p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unbekanntes Argument: $1 (--list, --download <latest|name>, --dest <dir>)" 1 ;;
  esac
  shift
done

if [ "$MODE" = "list" ]; then
  echo "Off-Site-Bestand in $B2_REMOTE:"
  rclone lsl "$B2_REMOTE" | sort -k2,3 || die "rclone lsl fehlgeschlagen" 2
  exit 0
fi

if [ "$MODE" = "download" ]; then
  mkdir -p "$DL_DEST"
  if [ "$DL_WHAT" = "latest" ]; then
    NAME=$(rclone lsl "$B2_REMOTE" --include "*.dump*" | sort -k2,3 | tail -n1 | awk '{print $NF}')
    [ -n "$NAME" ] || die "Remote $B2_REMOTE enthält keinen Dump" 3
  else
    NAME="$DL_WHAT"
  fi
  echo "Lade $NAME nach $DL_DEST ..."
  rclone copyto "$B2_REMOTE/$NAME" "$DL_DEST/$NAME" --no-traverse \
    || die "Download von $NAME fehlgeschlagen" 2

  # Sidecar-Checksumme mitziehen und prüfen — ein stiller Bit-Fehler in
  # einem Backup fällt sonst erst beim Restore auf, also im Ernstfall.
  if rclone copyto "$B2_REMOTE/${NAME}.sha256" "$DL_DEST/${NAME}.sha256" \
       --no-traverse 2>/dev/null; then
    EXPECTED=$(awk '{print $1}' "$DL_DEST/${NAME}.sha256")
    ACTUAL=$(sha256sum "$DL_DEST/$NAME" | awk '{print $1}')
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      die "Checksumme von $NAME stimmt NICHT (erwartet $EXPECTED, gemessen $ACTUAL)" 4
    fi
    echo "  Checksumme OK."
  else
    echo "  WARNUNG: keine .sha256 im Remote — Integrität nicht prüfbar."
  fi

  echo "Fertig: $DL_DEST/$NAME"
  case "$NAME" in
    *.gpg)
      echo "Entschlüsseln:"
      echo "  gpg --batch --quiet --decrypt --pinentry-mode loopback \\"
      echo "      --passphrase-file /opt/arctos/.backup.key \\"
      echo "      \"$DL_DEST/$NAME\" > \"${DL_DEST}/$(basename "${NAME%.gpg}")\"" ;;
  esac
  exit 0
fi

# ── Sync ──────────────────────────────────────────────────────────────────
[ -d "$BACKUP_DIR" ] || die "backup dir missing: $BACKUP_DIR" 1

START_TS=$(date -u +%s)
UPLOAD_COUNT=0
FAIL_COUNT=0
SKIPPED_PLAINTEXT=0

FILES=$(find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name "*.dump" -o -name "*.dump.gpg" -o -name "*.sql.gz" \
     -o -name "*.tar.gz" -o -name "*.tar.gz.gpg" -o -name "*.sha256" \) \
  -mmin "-$((MAX_AGE_HOURS * 60))" | sort)

# #S13-07: Klartext geht grundsätzlich NICHT nach draussen.
is_encrypted() {
  case "$1" in
    *.gpg)         return 0 ;;
    *.gpg.sha256)  return 0 ;;
    *)             return 1 ;;
  esac
}

for f in $FILES; do
  BASENAME=$(basename "$f")
  if ! is_encrypted "$BASENAME" && [ "${OFFSITE_ALLOW_PLAINTEXT:-0}" != "1" ]; then
    SKIPPED_PLAINTEXT=$((SKIPPED_PLAINTEXT + 1))
    log_json "{\"timestamp\":\"$(date -u -Iseconds)\",\"file\":\"$BASENAME\",\"skipped\":\"plaintext — refusing off-site upload (#S13-07)\"}"
    continue
  fi

  SIZE=$(stat -c%s "$f" 2>/dev/null || echo 0)
  SUB_START=$(date -u +%s%3N)
  if rclone copyto "$f" "$B2_REMOTE/$BASENAME" --immutable --no-traverse 2>/dev/null; then
    SUB_END=$(date -u +%s%3N)
    UPLOAD_COUNT=$((UPLOAD_COUNT + 1))
    log_json "{\"timestamp\":\"$(date -u -Iseconds)\",\"file\":\"$BASENAME\",\"size_bytes\":$SIZE,\"upload_duration_ms\":$((SUB_END - SUB_START)),\"remote\":\"$B2_REMOTE/$BASENAME\"}"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log_json "{\"timestamp\":\"$(date -u -Iseconds)\",\"file\":\"$BASENAME\",\"error\":\"rclone copy failed\"}"
    echo "FEHLER: Upload von $BASENAME fehlgeschlagen." >&2
  fi
done

END_TS=$(date -u +%s)
STATUS="ok"
[ "$UPLOAD_COUNT" -eq 0 ] && STATUS="nothing_uploaded"
[ "$SKIPPED_PLAINTEXT" -gt 0 ] && STATUS="skipped_plaintext"
[ "$FAIL_COUNT" -gt 0 ] && STATUS="failed"

SUMMARY="{\"timestamp\":\"$(date -u -Iseconds)\",\"summary\":{\"uploaded\":$UPLOAD_COUNT,\"failed\":$FAIL_COUNT,\"skipped_plaintext\":$SKIPPED_PLAINTEXT,\"status\":\"$STATUS\",\"total_duration_s\":$((END_TS - START_TS))}}"
log_json "$SUMMARY"
echo "$SUMMARY"
# #S13-23d: Grundlage der Alterungsmetrik arctos_offsite_backup_age_seconds.
echo "$SUMMARY" > "$BACKUP_DIR/.offsite-last-run.json"

if [ "$SKIPPED_PLAINTEXT" -gt 0 ]; then
  cat >&2 <<EOF

FEHLER: ${SKIPPED_PLAINTEXT} unverschlüsselte Backup-Dateien wurden NICHT
übertragen. ADR-015 §1 verlangt Verschlüsselung; bis zum Audit 2026-08-31
war sie nicht implementiert (#S13-07).

  Backup-Schlüssel anlegen und neu sichern:
      umask 077 && openssl rand -base64 48 > /opt/arctos/.backup.key
      chmod 0400 /opt/arctos/.backup.key
      bash /opt/arctos/deploy/db-backup.sh

  Der Schlüssel MUSS zusätzlich ausserhalb dieses Hosts liegen — ohne ihn
  ist kein Backup wiederherstellbar.

  Bewusst Klartext übertragen (nicht empfohlen):
      OFFSITE_ALLOW_PLAINTEXT=1 bash /opt/arctos/deploy/offsite-sync.sh

EOF
  exit 5
fi

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "FEHLER: $FAIL_COUNT Off-Site-Uploads fehlgeschlagen." >&2
  exit 2
fi
if [ "$UPLOAD_COUNT" -eq 0 ]; then
  echo "FEHLER: nichts übertragen — es gab keine Backup-Datei der letzten" >&2
  echo "        ${MAX_AGE_HOURS} h. Läuft db-backup.sh? (#S13-23b/c)" >&2
  exit 3
fi
echo "OK: $UPLOAD_COUNT Dateien nach $B2_REMOTE übertragen."
