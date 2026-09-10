#!/bin/sh
# ============================================================================
# #S13-10 (WP10) — Pre-Start-Gate für beide Produktionsimages.
#
# Läuft als ENTRYPOINT VOR allem anderen: prüft die Pflicht-Betriebsvariablen
# (scripts/assert-runtime-config.mjs) und übergibt erst danach an den
# eigentlichen Entrypoint bzw. das Kommando.
#
# Warum ein eigener Wrapper und nicht ein Block in docker-entrypoint.sh:
# der Entrypoint gehört WP1 (Migrations-Sequenz) und läuft nur im Web-Image.
# Der Worker hat gar keinen Entrypoint. Dieser Wrapper deckt beide ab und
# hält die Zuständigkeiten getrennt.
#
# Aufruf:
#   ENTRYPOINT ["/app/prestart.sh", "web"]     -> assert, dann docker-entrypoint.sh "$@"
#   ENTRYPOINT ["/app/prestart.sh", "worker"]  -> assert, dann exec "$@"
#
# Abbruchverhalten: assert-runtime-config.mjs beendet sich in
# NODE_ENV=production mit 78 (EX_CONFIG), wenn eine Pflichtvariable fehlt.
# `set -e` trägt das nach aussen — der Container startet dann NICHT. Das ist
# beabsichtigt: eine Instanz ohne APP_DATABASE_URL bedient jede Anfrage als
# Superuser und hebt die Mandantentrennung auf; ein nicht startender
# Container ist der deutlich harmlosere Ausgang.
#
# Not-Aus für einen Betriebsfall, in dem das Gate nachweislich falsch liegt:
#   ARCTOS_SKIP_CONFIG_ASSERT=true
# Das ist absichtlich lang, greppbar und im Log sichtbar.
# ============================================================================
set -e

ROLE="${1:-web}"
shift 2>/dev/null || true

if [ "${ARCTOS_SKIP_CONFIG_ASSERT}" = "true" ]; then
  echo "[prestart:${ROLE}] WARNUNG: ARCTOS_SKIP_CONFIG_ASSERT=true — die" \
       "Startup-Validierung der Pflichtkonfiguration ist ABGESCHALTET (#S13-10)."
else
  node /app/scripts/assert-runtime-config.mjs --role "${ROLE}"
fi

if [ "${ROLE}" = "web" ] && [ -x /app/docker-entrypoint.sh ]; then
  exec /app/docker-entrypoint.sh "$@"
fi

exec "$@"
