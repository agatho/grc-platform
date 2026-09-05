#!/usr/bin/env bash
# ============================================================================
# ARCTOS — Backup-, Off-Site- und DR-Drill-Cron installieren.
#
# [ARCTOS-FULL-2026-08-31 / WP10 · S13-23, S13-24, S13-08, S13-07]
#
# Was sich geändert hat und warum:
#
#  * S13-23(a) — DER OFF-SITE-SYNC WURDE NIE INSTALLIERT. Dieses Skript
#    schrieb genau EINE Cron-Zeile (Backup + Rotation). Der Off-Site-Sync
#    existierte nur als Copy-&-Paste-Vorschlag in `offsite-sync-setup.sh`,
#    `ADR-015:62-65` und `runbook.md:82`. Ob er auf einem gegebenen Host
#    lief, war nicht reproduzierbar feststellbar — die zweite
#    Failure-Domain, die Kernmotivation von ADR-015, war damit nicht
#    verlässlich hergestellt.
#
#  * S13-23(b) — DIE REIHENFOLGE WAR FALSCH. Die Dokumentation nannte
#    02:30 für den Sync, das Backup lief um 03:00: der Sync lief 30 Minuten
#    VOR dem Backup. Der 48-Stunden-Fensterfilter fing das am Folgetag auf,
#    sodass das Off-Site-Backup dauerhaft einen Tag hinterherhinkte — der
#    tatsächliche Off-Site-RPO war ~48 h statt der im DR-Playbook
#    zugesagten 24 h. → Beides läuft jetzt in EINER verketteten Zeile,
#    Sync NACH dem Backup. Eine Reihenfolge, die nicht auseinanderlaufen
#    kann.
#
#  * S13-24 — RETENTION WAR AN DREI STELLEN WIDERSPRÜCHLICH (30 / 14 / 30).
#    Effektiv galt 14, weil die schärfere Rotation gewann, während zwei
#    Dokumente 30 zusagten. → Beide Skripte lesen jetzt dieselbe Variable
#    aus `/etc/default/arctos-backup`. Zusätzlich MELDET die Größenkappung,
#    wenn sie greift — vorher verkürzte sie die Aufbewahrung
#    stillschweigend weiter.
#
#  * S13-08(a) — DER DR-DRILL WAR SEIT 2026-05-01 ÜBERFÄLLIG UND WURDE VON
#    KEINEM CRON AUSGELÖST. → Monatlicher Eintrag, Ergebnis maschinenlesbar.
#
#  * S13-07 — Legt bei Bedarf den symmetrischen Backup-Schlüssel an und
#    weist ausdrücklich darauf hin, dass eine Kopie ausserhalb des Hosts
#    liegen muss.
#
# Einmalig als root ausführen:
#   sudo bash deploy/backup-cron-install.sh
#
# Idempotent — ein erneuter Lauf ersetzt Cron und Rotationsskript.
# ============================================================================

set -euo pipefail

BACKUP_DIR="/opt/arctos/backups"
CRON_FILE="/etc/cron.d/arctos-backup"
DEFAULTS_FILE="/etc/default/arctos-backup"
ROTATE_SCRIPT="/opt/arctos/deploy/backup-rotate.sh"
BACKUP_SCRIPT="/opt/arctos/deploy/db-backup.sh"
OFFSITE_SCRIPT="/opt/arctos/deploy/offsite-sync.sh"
DRILL_SCRIPT="/opt/arctos/scripts/dr-restore-drill.sh"
BACKUP_KEY_FILE="/opt/arctos/.backup.key"

# #S13-24: DIE eine Quelle der Aufbewahrungsfrist.
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
SIZE_CAP_GB="${BACKUP_SIZE_CAP_GB:-20}"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "must be run as root (sudo)" >&2
  exit 1
fi

if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "db-backup.sh not found at $BACKUP_SCRIPT" >&2
  exit 1
fi

# ── 0. Backup-Schlüssel (#S13-07) ─────────────────────────────────────────
if [ ! -f "$BACKUP_KEY_FILE" ]; then
  echo "[0/4] Backup-Schlüssel anlegen ($BACKUP_KEY_FILE)..."
  ( umask 077; openssl rand -base64 48 > "$BACKUP_KEY_FILE" )
  chmod 0400 "$BACKUP_KEY_FILE"
  chown root:root "$BACKUP_KEY_FILE"
  cat <<EOF

  ############################################################
  #  WICHTIG — SOFORT ERLEDIGEN
  #
  #  Der Backup-Schlüssel liegt jetzt unter $BACKUP_KEY_FILE
  #  (mode 0400, root). Ohne ihn ist KEIN Backup wiederherstellbar.
  #
  #  Legen Sie JETZT eine Kopie AUSSERHALB dieses Hosts ab
  #  (Passwort-Safe, versiegelter Umschlag im Tresor). Ein Host-
  #  Totalverlust nimmt den Schlüssel sonst mit — und damit jede
  #  Wiederherstellbarkeit, obwohl die Off-Site-Kopien intakt sind.
  #
  #      sudo cat $BACKUP_KEY_FILE
  #
  #  Ins Notfallhandbuch aufnehmen (docs/dr-playbook.md §0).
  ############################################################

EOF
else
  echo "[0/4] Backup-Schlüssel vorhanden ($BACKUP_KEY_FILE)."
fi

# ── 1. Gemeinsame Konfiguration (#S13-24) ─────────────────────────────────
echo "[1/4] Konfiguration schreiben ($DEFAULTS_FILE)..."
cat > "$DEFAULTS_FILE" <<EOF
# ARCTOS Backup — von deploy/backup-cron-install.sh erzeugt.
# #S13-24: DIE eine Quelle der Aufbewahrungsfrist. db-backup.sh und
# backup-rotate.sh lesen beide von hier; docs/runbook.md und
# docs/dr-playbook.md verweisen auf diese Datei, statt eigene Zahlen zu nennen.
BACKUP_DIR=$BACKUP_DIR
BACKUP_RETENTION_DAYS=$RETENTION_DAYS
BACKUP_SIZE_CAP_GB=$SIZE_CAP_GB
BACKUP_KEY_FILE=$BACKUP_KEY_FILE
EOF
chmod 0644 "$DEFAULTS_FILE"

# ── 2. Rotationsskript ────────────────────────────────────────────────────
echo "[2/4] Rotationsskript schreiben ($ROTATE_SCRIPT)..."
cat > "$ROTATE_SCRIPT" <<'EOF'
#!/usr/bin/env bash
# Von deploy/backup-cron-install.sh erzeugt — nicht von Hand ändern.
set -euo pipefail
# shellcheck disable=SC1091
[ -f /etc/default/arctos-backup ] && . /etc/default/arctos-backup
BACKUP_DIR="${BACKUP_DIR:-/opt/arctos/backups}"
# #S13-24: dieselbe Zahl wie db-backup.sh. Vorher stand hier ein fest
# verdrahtetes KEEP_DAYS=14, während db-backup.sh 30 Tage löschte und zwei
# Dokumente 30 zusagten — effektiv galt 14, und niemand wusste es.
KEEP_DAYS="${BACKUP_RETENTION_DAYS:-30}"
SIZE_CAP_BYTES=$(( ${BACKUP_SIZE_CAP_GB:-20} * 1024 * 1024 * 1024 ))

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name '*.dump' -o -name '*.dump.gpg' -o -name '*.sql.gz' \
     -o -name '*.tar.gz' -o -name '*.tar.gz.gpg' -o -name '*.sha256' \) \
  -mtime "+${KEEP_DAYS}" -print -delete

# Harte Kappung. #S13-24: sie greift jetzt SICHTBAR — vorher verkürzte sie
# die Aufbewahrung bei wachsendem Datenbestand stillschweigend weiter, ohne
# dass irgendeine Meldung entstand.
CAPPED=0
while :; do
  USED=$(du -sb "$BACKUP_DIR" | awk '{print $1}')
  [ "$USED" -le "$SIZE_CAP_BYTES" ] && break
  OLDEST=$(find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name '*.dump' -o -name '*.dump.gpg' -o -name '*.tar.gz' -o -name '*.tar.gz.gpg' \) \
    -printf '%T@ %p\n' | sort -n | head -1 | awk '{print $2}')
  [ -z "$OLDEST" ] && break
  BASE="${OLDEST%.gpg}"; BASE="${BASE%.dump}"; BASE="${BASE%.tar.gz}"; BASE="${BASE%.sql.gz}"
  rm -fv "${BASE}".dump* "${BASE}".sql.gz* "${BASE}".tar.gz* 2>/dev/null || true
  CAPPED=$((CAPPED + 1))
done
if [ "$CAPPED" -gt 0 ]; then
  echo "WARNUNG: Groessenkappung hat $CAPPED Generationen entfernt — die"
  echo "         effektive Aufbewahrung liegt damit UNTER ${KEEP_DAYS} Tagen."
  echo "         BACKUP_SIZE_CAP_GB in /etc/default/arctos-backup erhoehen"
  echo "         oder Plattenplatz schaffen (#S13-24)."
fi

date -u +%FT%TZ > "$BACKUP_DIR/.last-run"
EOF
chmod +x "$ROTATE_SCRIPT"

# ── 3. Cron ───────────────────────────────────────────────────────────────
echo "[3/4] Cron schreiben ($CRON_FILE)..."
OFFSITE_LINE="# offsite-sync.sh nicht gefunden — Off-Site-Backup NICHT installiert (#S13-23a)"
if [ -f "$OFFSITE_SCRIPT" ]; then
  OFFSITE_LINE="&& ${OFFSITE_SCRIPT} >>${BACKUP_DIR}/cron.log 2>&1"
fi
DRILL_LINE="# dr-restore-drill.sh nicht gefunden — DR-Drill NICHT installiert (#S13-08a)"
if [ -f "$DRILL_SCRIPT" ]; then
  DRILL_LINE="0 5 1 * * root ${DRILL_SCRIPT} >>${BACKUP_DIR}/dr-drill.log 2>&1"
fi

cat > "$CRON_FILE" <<EOF
# ARCTOS — naechtliches Backup, Rotation, Off-Site-Sync und DR-Drill
# Installiert von deploy/backup-cron-install.sh — neu erzeugen, nicht von
# Hand bearbeiten.
#
# #S13-23b: Backup, Rotation und Off-Site-Sync laufen in EINER verketteten
# Zeile. Vorher war der Sync nur ein Doku-Vorschlag mit einer Uhrzeit VOR
# dem Backup (02:30 vs. 03:00) — er uebertrug dadurch dauerhaft den Stand
# des Vortags, der Off-Site-RPO war faktisch 48 h statt der zugesagten 24 h.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""

0 3 * * * root ${BACKUP_SCRIPT} >>${BACKUP_DIR}/cron.log 2>&1 && ${ROTATE_SCRIPT} >>${BACKUP_DIR}/cron.log 2>&1 ${OFFSITE_LINE}

# #S13-08a: monatlicher Restore-Drill, 1. des Monats 05:00 UTC. Er war seit
# 2026-05-01 faellig, von keinem Cron ausgeloest und ohne jeden
# Ausfuehrungsnachweis im Repository.
${DRILL_LINE}
EOF
chmod 0644 "$CRON_FILE"

mkdir -p "$BACKUP_DIR"
chown -R arctos:arctos "$BACKUP_DIR" 2>/dev/null || true
chmod 0700 "$BACKUP_DIR"

# ── 4. Ergebnis ───────────────────────────────────────────────────────────
echo "[4/4] Fertig."
echo ""
echo "Installiert:"
echo "  $CRON_FILE"
echo "  $ROTATE_SCRIPT"
echo "  $DEFAULTS_FILE   (Retention: ${RETENTION_DAYS} Tage, Kappung ${SIZE_CAP_GB} GB)"
if [ -f "$OFFSITE_SCRIPT" ]; then
  echo "  Off-Site-Sync:  ja, verkettet NACH dem Backup (#S13-23)"
else
  echo "  Off-Site-Sync:  NEIN — $OFFSITE_SCRIPT fehlt (#S13-23a)"
fi
if [ -f "$DRILL_SCRIPT" ]; then
  echo "  DR-Drill:       monatlich, 1. um 05:00 UTC (#S13-08)"
else
  echo "  DR-Drill:       NEIN — $DRILL_SCRIPT fehlt (#S13-08a)"
fi
echo ""
echo "Pruefen mit:"
echo "  sudo ${BACKUP_SCRIPT}                    # Backup jetzt"
echo "  sudo ${OFFSITE_SCRIPT} --list            # Off-Site-Bestand"
echo "  sudo ${DRILL_SCRIPT}                     # Restore-Drill jetzt"
echo "  cat ${BACKUP_DIR}/.last-run.json"
echo "  cat ${BACKUP_DIR}/.offsite-last-run.json"
echo "  cat ${BACKUP_DIR}/.dr-drill-last-run.json"
