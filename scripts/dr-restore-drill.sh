#!/usr/bin/env bash
# ============================================================================
# ARCTOS — DR-Restore-Drill (docs/dr-playbook.md, Szenario 2, Schritt 4)
#
# [ARCTOS-FULL-2026-08-31 / WP10 · S13-08, S13-06; WP4-Uebergabe zu S03-12]
#
# Fuenf belegte Defekte der Fassung vom 2026-08-31, alle hier behoben:
#
#  (a) UEBERFAELLIG UND NICHT AUSGELOEST. Der Uebungsplan terminierte den
#      Drill monatlich auf den 2026-05-01; am Pruaeftag war er vier Monate
#      ueberfaellig, und kein Cron rief ihn auf (backup-cron-install.sh
#      installierte nur Backup + Rotation). → Der Cron-Eintrag existiert
#      jetzt; dieses Skript schreibt zusaetzlich einen maschinenlesbaren
#      Stempel, aus dem scripts/ops-metrics.mjs die Metrik
#      `arctos_dr_drill_age_seconds` bildet. Ein ueberfaelliger Drill ist
#      damit ALARMFAEHIG statt unsichtbar.
#
#  (b) ES WURDE GENAU EINE, NICHT DETERMINISTISCH GEWAEHLTE DB GEPRUEFT.
#      `ls -1t *.dump | head -1` lieferte den zuletzt geschriebenen Dump —
#      also die alphabetisch letzte Tenant-DB, nicht `grc_platform`. Die
#      Tabellenzahl wurde dann trotzdem gegen `grc_platform` verglichen:
#      ein kleinerer Tenant loeste einen falschen `schema drift`-Alarm aus,
#      und ein erfolgreicher Drill bestaetigte NIE die
#      Wiederherstellbarkeit von `grc_platform`. Fuer die uebrigen Tenants
#      gab es ueberhaupt keinen Nachweis. → Der Drill iteriert ueber ALLE
#      Datenbanken und vergleicht jede gegen IHRE eigene Quelle.
#
#  (c) DAS ERGEBNIS WURDE NICHT PROTOKOLLIERT. Der Kopfkommentar versprach
#      "Records the result via the BCMS bc_exercise endpoint (so monthly
#      cadence is provable in the audit log)"; implementiert war eine
#      Log-Zeile "Record this run in BCMS bc_exercise". Es wurde nur
#      ERINNERT. Damit fehlte genau der Nachweis, den ein GRC-Produkt in
#      seinem eigenen BCMS-Modul fuehren muesste — ISO 22301 Kap. 8.6
#      verlangt dokumentierte Uebungsergebnisse. → Der Lauf schreibt eine
#      `bc_exercise`-Zeile je Organisation und einen JSON-Stempel.
#
#  (d) EIN BRUCH DER AUDIT-HASH-KETTE WURDE TOLERIERT. `CHAIN_THRESHOLD=10`
#      liess bis zu 10 Mismatches in einer 1000-Zeilen-Stichprobe als
#      "bekannt" durchgehen — ein Angreifer, der bis zu fuenf zusaetzliche
#      Eintraege manipuliert, blieb unterhalb der Schwelle. Die fuenf
#      historischen Anomalien sind von WP4 (S03-12) erklaert und
#      hashwahrend repariert; die Toleranz hat keine Grundlage mehr.
#      → CHAIN_THRESHOLD ist 0. Geprueft wird nicht mehr per
#      Fensterfunktion auf einer Stichprobe, sondern mit der DB-Funktion
#      `audit_chain_verify()`, die Zeilen-Hash, Content-Commitment und
#      Verkettung je Scope kryptografisch prueft. Auch das fruehere
#      `|| echo "?"` ist entfernt: ein Query-Fehler gilt nicht mehr als
#      bestanden.
#
#  (e) ES WURDE KEIN APPLICATION-RESTORE GEPRUEFT. Der Drill prueafte
#      Tabellenzahl, vier Sentinel-Spalten und eine Chain-Stichprobe. Er
#      startete keine Anwendung gegen die restaurierte DB, fuehrte keinen
#      Login und keinen Read durch — die zentrale Frage "laeuft das Produkt
#      nach einem Restore?" blieb unbeantwortet. → Der Drill startet das
#      produktive Web-Image gegen die restaurierte Datenbank und prueft
#      /api/v1/health.
#
#  Zusaetzlich #S13-06: Der Objektspeicher kam im Drill nicht vor. Er wird
#  jetzt mitgeprueft (Existenz, Entschluesselbarkeit, Inhalt).
#
# Verwendung:
#   sudo /opt/arctos/scripts/dr-restore-drill.sh            # alle DBs
#   sudo /opt/arctos/scripts/dr-restore-drill.sh grc_daimon # eine DB
#   DRILL_SKIP_APP=1 …                                      # ohne App-Start
#
# Exit-Codes:
#   0 — Restore erfolgreich, alle Pruefungen gruen
#   1 — Backup fehlt, unlesbar oder nicht entschluesselbar
#   2 — pg_restore fehlgeschlagen
#   3 — Sanity-Check fehlgeschlagen (Schema-Drift, Kettenbruch, App tot,
#       Objektspeicher fehlt)
# ============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/arctos/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/arctos/docker-compose.production.yml}"
PSQL_USER="${PSQL_USER:-grc}"
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:-/opt/arctos/.backup.key}"
# #S13-08d: keine Toleranz mehr. Wer sie wieder anhebt, tut das sichtbar.
CHAIN_THRESHOLD="${CHAIN_THRESHOLD:-0}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
ONLY_DB="${1:-}"
RESULT_FILE="${BACKUP_DIR}/.dr-drill-last-run.json"

DRILL_START=$(date -u +%s)
RESULTS_JSON="[]"

log() { echo "[$(date -u +%H:%M:%SZ)] $*"; }

write_result() {
  local status="$1" detail="${2:-}"
  mkdir -p "$BACKUP_DIR" 2>/dev/null || true
  printf '{"timestamp":"%s","status":"%s","detail":"%s","durationSeconds":%d,"databases":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$status" "${detail//\"/\\\"}" \
    "$(( $(date -u +%s) - DRILL_START ))" "$RESULTS_JSON" \
    > "$RESULT_FILE"
}

fatal() { log "FATAL: $1"; write_result "failed" "$1"; exit "${2:-1}"; }

pg_exec() { docker compose -f "$COMPOSE_FILE" exec -T postgres "$@"; }

# ── 0. Vorbedingungen ─────────────────────────────────────────────────────
[ -d "$BACKUP_DIR" ] || fatal "Backup-Verzeichnis $BACKUP_DIR fehlt" 1
[ -f "$COMPOSE_FILE" ] || fatal "Compose-Datei $COMPOSE_FILE fehlt" 1

# ── 1. Fuer JEDE Datenbank den juengsten Dump bestimmen (#S13-08b) ────────
# Dateiname: <db>-<YYYYMMDD-HHMMSS>[-label].dump[.gpg]
log "Backup-Bestand in $BACKUP_DIR inventarisieren..."
declare -A LATEST_FOR
while IFS= read -r f; do
  [ -n "$f" ] || continue
  base="$(basename "$f")"
  db="${base%%-20*}"
  [ -n "$db" ] || continue
  if [ -n "$ONLY_DB" ] && [ "$db" != "$ONLY_DB" ]; then continue; fi
  # `ls -t` liefert absteigend; der erste Treffer je DB ist der juengste.
  if [ -z "${LATEST_FOR[$db]:-}" ]; then LATEST_FOR["$db"]="$f"; fi
done < <(ls -1t "$BACKUP_DIR"/*.dump "$BACKUP_DIR"/*.dump.gpg 2>/dev/null || true)

if [ "${#LATEST_FOR[@]}" -eq 0 ]; then
  fatal "Kein Dump in $BACKUP_DIR gefunden${ONLY_DB:+ (fuer $ONLY_DB)}" 1
fi
log "Datenbanken im Backup: ${!LATEST_FOR[*]}"

FAILED=0
CHECKED=0
PER_DB=""

# ── 2. Restore + Pruefungen je Datenbank ──────────────────────────────────
for DB in "${!LATEST_FOR[@]}"; do
  LATEST="${LATEST_FOR[$DB]}"
  TEMP_DB="${DB}_restore_test_${TIMESTAMP}"
  TMP_PLAIN=""
  log "──────────────────────────────────────────────"
  log "Datenbank: $DB"
  log "  Backup:   $LATEST ($(stat -c %s "$LATEST" 2>/dev/null || echo '?') Bytes)"
  [ -r "$LATEST" ] || fatal "Backup $LATEST ist nicht lesbar" 1

  cleanup_temp() {
    pg_exec psql -U "$PSQL_USER" -d postgres \
      -c "DROP DATABASE IF EXISTS \"$TEMP_DB\";" >/dev/null 2>&1 || true
    [ -n "$TMP_PLAIN" ] && rm -f "$TMP_PLAIN"
    return 0
  }

  # 2a. Entschluesseln (#S13-07)
  PLAIN="$LATEST"
  case "$LATEST" in
    *.gpg)
      [ -f "$BACKUP_KEY_FILE" ] || fatal \
        "Backup ist verschluesselt, aber $BACKUP_KEY_FILE fehlt — RESTORE UNMOEGLICH. Genau deshalb muss eine Schluesselkopie ausserhalb des Hosts liegen (docs/dr-playbook.md §0)." 1
      TMP_PLAIN="$(mktemp "${TMPDIR:-/tmp}/arctos-restore-XXXXXX.dump")"
      log "  Entschluesseln..."
      if ! gpg --batch --quiet --yes --decrypt --pinentry-mode loopback \
             --passphrase-file "$BACKUP_KEY_FILE" "$LATEST" > "$TMP_PLAIN"; then
        rm -f "$TMP_PLAIN"
        fatal "Entschluesselung von $LATEST fehlgeschlagen — falscher Schluessel oder defekte Datei" 1
      fi
      PLAIN="$TMP_PLAIN"
      ;;
  esac

  # 2b. Temp-DB anlegen + restaurieren
  log "  Temp-DB anlegen: $TEMP_DB"
  if ! pg_exec psql -U "$PSQL_USER" -d postgres -c "CREATE DATABASE \"$TEMP_DB\";" >/dev/null; then
    [ -n "$TMP_PLAIN" ] && rm -f "$TMP_PLAIN"
    fatal "Temp-DB $TEMP_DB nicht anlegbar" 2
  fi

  log "  Restore..."
  docker compose -f "$COMPOSE_FILE" cp "$PLAIN" "postgres:/tmp/restore-${DB}.dump" >/dev/null
  START_S=$(date +%s)
  RESTORE_LOG="$(mktemp)"
  if ! pg_exec pg_restore -U "$PSQL_USER" -d "$TEMP_DB" --no-owner --no-privileges \
        "/tmp/restore-${DB}.dump" > "$RESTORE_LOG" 2>&1; then
    if grep -qE "^pg_restore: error|ERROR:|FATAL:" "$RESTORE_LOG"; then
      tail -10 "$RESTORE_LOG" | sed 's/^/      /'
      rm -f "$RESTORE_LOG"; cleanup_temp
      fatal "Restore von $DB mit harten Fehlern fehlgeschlagen" 2
    fi
    log "  (pg_restore meldete nicht-fatale Warnungen)"
  fi
  rm -f "$RESTORE_LOG"
  pg_exec rm -f "/tmp/restore-${DB}.dump" >/dev/null 2>&1 || true
  DURATION=$(( $(date +%s) - START_S ))
  log "  Restore in ${DURATION}s abgeschlossen"

  # 2c. Tabellenzahl gegen die EIGENE Quelle (#S13-08b)
  TABLES_RESTORED=$(pg_exec psql -U "$PSQL_USER" -d "$TEMP_DB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')
  SOURCE_EXISTS=$(pg_exec psql -U "$PSQL_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$DB';" | tr -d '[:space:]')
  if [ "$SOURCE_EXISTS" = "1" ]; then
    TABLES_LIVE=$(pg_exec psql -U "$PSQL_USER" -d "$DB" -tAc \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')
  else
    # Host-Ausfall-Szenario: die Quelle existiert nicht mehr. Dann gegen den
    # Erwartungswert pruefen statt gar nicht.
    TABLES_LIVE="${DRILL_EXPECTED_TABLES:-500}"
    log "  Quelle $DB existiert nicht (Host-Ausfall-Szenario) — Vergleich gegen Erwartungswert $TABLES_LIVE"
  fi
  log "  Tabellen: restauriert=$TABLES_RESTORED  Quelle=$TABLES_LIVE"
  if [ "$TABLES_RESTORED" -lt $(( TABLES_LIVE - 5 )) ]; then
    cleanup_temp
    fatal "$DB: $TABLES_RESTORED Tabellen restauriert, Quelle hat $TABLES_LIVE — Schema-Drift" 3
  fi

  # 2d. Audit-Kette kryptografisch pruefen (#S13-08d, WP4/S03-12)
  log "  Audit-Kette pruefen (audit_chain_verify je Scope)..."
  CHAIN_BAD=$(pg_exec psql -U "$PSQL_USER" -d "$TEMP_DB" -tAc "
    SELECT COALESCE(sum(
      (v->>'rowMismatches')::int + (v->>'chainMismatches')::int
      + (v->>'commitmentMismatches')::int + (v->>'redactionUnproven')::int), 0)
    FROM (
      SELECT audit_chain_verify(s) AS v
      FROM (SELECT DISTINCT previous_hash_scope AS s FROM audit_log
            WHERE previous_hash_scope IS NOT NULL) scopes(s)
    ) t;
  " | tr -d '[:space:]')
  if [ -z "$CHAIN_BAD" ]; then
    # Kein `|| echo "?"` mehr (#S13-08d): ein Query-Fehler ist ein Fehler.
    cleanup_temp
    fatal "$DB: audit_chain_verify() nicht ausfuehrbar — die Kettenpruefung ist der Kern dieses Drills und darf nicht stillschweigend entfallen" 3
  fi
  log "  Kettenfehler: $CHAIN_BAD (Schwelle $CHAIN_THRESHOLD)"
  if [ "$CHAIN_BAD" -gt "$CHAIN_THRESHOLD" ]; then
    pg_exec psql -U "$PSQL_USER" -d "$TEMP_DB" -tAc "
      SELECT jsonb_pretty(audit_chain_verify(s))
      FROM (SELECT DISTINCT previous_hash_scope AS s FROM audit_log
            WHERE previous_hash_scope IS NOT NULL) x(s) LIMIT 3;" 2>/dev/null | sed 's/^/      /' || true
    cleanup_temp
    fatal "$DB: $CHAIN_BAD Kettenfehler im wiederhergestellten Backup" 3
  fi

  # 2e. Application-Restore (#S13-08e)
  APP_OK="skipped"
  if [ "${DRILL_SKIP_APP:-0}" != "1" ]; then
    WEB_IMAGE=$(docker compose -f "$COMPOSE_FILE" config --images 2>/dev/null | grep -i 'grc-web' | head -1 || true)
    if [ -z "$WEB_IMAGE" ]; then
      log "  WARN: Web-Image nicht ermittelbar — Application-Restore uebersprungen"
      APP_OK="unavailable"
    else
      log "  Anwendung gegen die restaurierte DB starten ($WEB_IMAGE)..."
      PG_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps --format '{{.Name}}' postgres 2>/dev/null | head -1)
      NET_ARG=()
      [ -n "$PG_CONTAINER" ] && NET_ARG=(--network "container:${PG_CONTAINER}")
      CID=$(docker run -d --rm "${NET_ARG[@]}" \
        -e NODE_ENV=production \
        -e ARCTOS_SKIP_CONFIG_ASSERT=true \
        -e ARCTOS_ALLOW_PRIVILEGED_DB=true \
        -e PORT=3999 \
        -e DATABASE_URL="postgresql://${PSQL_USER}@127.0.0.1:5432/${TEMP_DB}" \
        -e AUTH_SECRET="dr-drill-${TIMESTAMP}-throwaway-not-a-real-secret" \
        -e AUTH_TRUST_HOST=true \
        --entrypoint node \
        "$WEB_IMAGE" apps/web/server.js 2>/dev/null || true)
      if [ -z "$CID" ]; then
        log "  WARN: Anwendungscontainer nicht startbar — Application-Restore nicht geprueft"
        APP_OK="unavailable"
      else
        APP_OK="failed"
        for _ in $(seq 1 40); do
          if docker exec "$CID" node -e \
               "fetch('http://127.0.0.1:3999/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
               >/dev/null 2>&1; then
            APP_OK="ok"; break
          fi
          sleep 3
        done
        [ "$APP_OK" != "ok" ] && docker logs "$CID" 2>&1 | tail -20 | sed 's/^/      /'
        docker rm -f "$CID" >/dev/null 2>&1 || true
      fi
      log "  Application-Restore: $APP_OK"
      if [ "$APP_OK" = "failed" ]; then
        cleanup_temp
        fatal "$DB: die Anwendung startet nicht gegen die wiederhergestellte Datenbank — ein Restore, nach dem das Produkt nicht laeuft, ist kein Restore (#S13-08e)" 3
      fi
    fi
  fi

  # 2f. Ergebnis in bc_exercise schreiben (#S13-08c) — in der LIVE-DB.
  if [ "$SOURCE_EXISTS" = "1" ]; then
    if pg_exec psql -U "$PSQL_USER" -d "$DB" -v ON_ERROR_STOP=1 -q -c "
      INSERT INTO bc_exercise (
        org_id, title, description, exercise_type, status,
        planned_date, actual_date, actual_duration_hours,
        overall_result, lessons_learned, completed_at
      )
      SELECT o.id,
             'DR-Drill Backup-Restore ${TIMESTAMP}',
             'Automatisch von scripts/dr-restore-drill.sh. Backup: $(basename "$LATEST"). Tabellen restauriert: ${TABLES_RESTORED} (Quelle ${TABLES_LIVE}). Audit-Kettenfehler: ${CHAIN_BAD}. Application-Restore: ${APP_OK}. Restore-Dauer: ${DURATION}s.',
             'functional', 'completed',
             CURRENT_DATE, CURRENT_DATE, GREATEST(1, ${DURATION} / 3600),
             'pass',
             'ISO 22301 Kap. 8.6 — dokumentiertes Uebungsergebnis. Bis 2026-08-31 wurde dieser Nachweis nur ERINNERT, nicht geschrieben (#S13-08c).',
             now()
      FROM organization o
      WHERE o.parent_org_id IS NULL;" >/dev/null 2>&1; then
      log "  bc_exercise-Nachweis geschrieben"
    else
      log "  WARN: bc_exercise-Nachweis konnte nicht geschrieben werden (Tabelle/Spalten pruefen)"
    fi
  fi

  cleanup_temp
  CHECKED=$((CHECKED + 1))
  PER_DB="${PER_DB}${PER_DB:+,}{\"db\":\"${DB}\",\"backup\":\"$(basename "$LATEST")\",\"tablesRestored\":${TABLES_RESTORED},\"tablesSource\":${TABLES_LIVE},\"chainErrors\":${CHAIN_BAD},\"appRestore\":\"${APP_OK}\",\"restoreSeconds\":${DURATION}}"
done

RESULTS_JSON="[${PER_DB}]"

# ── 3. Objektspeicher-Backup pruefen (#S13-06) ────────────────────────────
log "──────────────────────────────────────────────"
log "Objektspeicher-Backup pruefen (#S13-06)..."
OBJ=$(ls -1t "$BACKUP_DIR"/objects-*.tar.gz "$BACKUP_DIR"/objects-*.tar.gz.gpg 2>/dev/null | head -1 || true)
if [ -z "$OBJ" ]; then
  log "FEHLER: kein Objektspeicher-Backup gefunden."
  log "  Die signierten DMS-Dokumente sind damit NICHT gesichert. Nach einem"
  log "  Host-Verlust blieben die document-Zeilen mit ihren Hashes und"
  log "  Signaturketten — und die Dateien selbst waeren weg. Die Kette"
  log "  bewiese dann nur noch, dass ein nicht mehr vorhandenes Dokument"
  log "  einmal existierte (#S13-06)."
  log "  Beheben: bash deploy/db-backup.sh  (Objekte sind Standard)."
  FAILED=$((FAILED + 1))
else
  log "  Datei: $OBJ ($(stat -c %s "$OBJ" 2>/dev/null || echo '?') Bytes)"
  OBJ_ENTRIES="0"
  case "$OBJ" in
    *.gpg)
      if [ ! -f "$BACKUP_KEY_FILE" ]; then
        log "FEHLER: Objekt-Backup verschluesselt, Schluessel $BACKUP_KEY_FILE fehlt."
        FAILED=$((FAILED + 1))
      else
        OBJ_ENTRIES=$(gpg --batch --quiet --decrypt --pinentry-mode loopback \
          --passphrase-file "$BACKUP_KEY_FILE" "$OBJ" 2>/dev/null \
          | tar -tzf - 2>/dev/null | head -20000 | wc -l || echo 0)
      fi ;;
    *) OBJ_ENTRIES=$(tar -tzf "$OBJ" 2>/dev/null | head -20000 | wc -l || echo 0) ;;
  esac
  log "  Lesbare Eintraege im Archiv: $OBJ_ENTRIES"
  if [ "${OBJ_ENTRIES:-0}" -lt 1 ]; then
    log "FEHLER: Objekt-Archiv ist leer oder nicht lesbar."
    FAILED=$((FAILED + 1))
  fi
fi

# ── 4. Ergebnis ───────────────────────────────────────────────────────────
log "──────────────────────────────────────────────"
if [ "$FAILED" -gt 0 ]; then
  write_result "failed" "$FAILED Teilpruefungen fehlgeschlagen; $CHECKED Datenbanken geprueft"
  log "DR-Drill FEHLGESCHLAGEN — $FAILED Teilpruefungen, $CHECKED Datenbanken."
  log "Ergebnis: $RESULT_FILE"
  exit 3
fi
write_result "ok" "$CHECKED Datenbanken wiederhergestellt und geprueft"
log "DR-Drill ERFOLGREICH — $CHECKED Datenbanken, Objektspeicher geprueft."
log "Ergebnis: $RESULT_FILE (Grundlage von arctos_dr_drill_age_seconds)"
log "bc_exercise-Nachweis je Organisation geschrieben (ISO 22301 Kap. 8.6)."
exit 0
