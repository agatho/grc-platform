#!/bin/sh
# ============================================================================
# ARCTOS Docker Entrypoint
# Runs database migrations on startup, then starts the application
#
# [ARCTOS-FULL-2026-08-31 / WP1] Überarbeitet für S13-03, S13-21, S09-12
# und ADR-023 §1. Vorher galt:
#   * `-v ON_ERROR_STOP=0`  → Statements liefen nach einem Fehler weiter, eine
#     Migration konnte halb greifen; das Ergebnis war kein „angewendet oder
#     nicht", sondern ein undefinierter Zwischenzustand pro Datei.
#   * `>/dev/null 2>&1`     → die Fehlermeldung wurde vernichtet. Der Operator
#     erfuhr eine Zahl („37 failed"), nie welche Datei mit welchem Fehler.
#   * kein Abbruch          → `exec "$@"` lief unbedingt, der Container meldete
#     sich „gestartet", und die Routen ohne Tabellen lieferten 500.
#   * keine Serialisierung  → mehrere Container führten dieselbe DDL-Sequenz
#     nebenläufig gegen dieselbe Datenbank aus.
# ============================================================================
set -e

echo "ARCTOS GRC Platform starting..."

MIGRATION_DIR="${MIGRATION_DIR:-/app/packages/db/drizzle}"
# Konvergenz-Pässe. Ein kleiner Rest der Migrationen ist nicht strikt
# topologisch sortiert (0068/0069 brauchen `catalog` aus 0075, 0106 braucht
# `framework_mapping` aus 0107). Der Runner packages/db/src/migrate-all.ts
# löst das seit jeher über mehrere Pässe; damit Produktion, CI, Dev und DR
# dasselbe Schema erzeugen (S09-02), tut der Entrypoint das jetzt ebenso —
# aber mit ON_ERROR_STOP=1 und hartem Abbruch, wenn nach dem letzten Pass
# noch etwas fehlschlägt.
MIGRATION_PASSES="${MIGRATION_PASSES:-3}"
# Beliebige, aber feste Kennung für den Advisory-Lock.
MIGRATION_LOCK_KEY="${MIGRATION_LOCK_KEY:-491972031}"
# Adoption einer bereits bestehenden Datenbank: siehe Kommentar bei
# _arctos_migrations weiter unten.
MIGRATION_ADOPT_EXISTING="${MIGRATION_ADOPT_EXISTING:-true}"

# ─────────────────────────────────────────────────────────────────
# Run migrations if DATABASE_URL is set and psql is available
# ─────────────────────────────────────────────────────────────────
if [ "$SKIP_MIGRATIONS" = "true" ]; then
  echo "Skipping migrations (SKIP_MIGRATIONS=true)."
elif [ -n "$DATABASE_URL" ] && command -v psql >/dev/null 2>&1; then
  echo "Running database migrations..."

  # Extract connection details from DATABASE_URL
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

  export PGPASSWORD="$DB_PASS"
  PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

  # Wait for PostgreSQL
  echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
  DB_READY=0
  i=1
  while [ "$i" -le 60 ]; do
    if $PSQL -c "SELECT 1" >/dev/null 2>&1; then
      echo "PostgreSQL ready."
      DB_READY=1
      break
    fi
    sleep 1
    i=$((i + 1))
  done
  if [ "$DB_READY" -ne 1 ]; then
    echo "FATAL: PostgreSQL at $DB_HOST:$DB_PORT did not become reachable." >&2
    exit 1
  fi

  # Ensure required extensions exist. This one may legitimately fail on a
  # managed database where the role lacks CREATE EXTENSION — the migrations
  # below then surface the real problem with a precise error.
  echo "Ensuring required PostgreSQL extensions..."
  $PSQL -v ON_ERROR_STOP=1 \
    -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" \
    >/dev/null || echo "WARNING: could not ensure extensions (continuing)." >&2

  # ── Serialisierung mehrerer Container (S13-03) ──────────────────
  # `docker compose up -d --force-recreate` startet web, worker und die
  # Tenant-Container gleichzeitig; alle durchlaufen diesen Entrypoint und
  # fuhren dieselbe DDL-Sequenz gegen dieselbe Datenbank aus. Ohne Lock sind
  # Deadlocks und Teil-Anwendungen moeglich.
  #
  # Ein Hintergrund-psql haelt einen Session-Advisory-Lock, solange es lebt.
  # pg_advisory_lock() blockiert, bis der Lock frei ist — der zweite Container
  # wartet also, statt parallel zu migrieren. Faellt der Container aus, bricht
  # die Verbindung ab und PostgreSQL gibt den Lock von selbst frei.
  MIGRATION_LOCK_TIMEOUT="${MIGRATION_LOCK_TIMEOUT:-1800}"
  LOCK_HELD=0
  LOCK_PID=""
  $PSQL -Atq -c "SELECT pg_advisory_lock($MIGRATION_LOCK_KEY); SELECT pg_sleep($MIGRATION_LOCK_TIMEOUT);" >/dev/null 2>&1 &
  LOCK_PID=$!
  w=0
  while [ "$w" -lt "$MIGRATION_LOCK_TIMEOUT" ]; do
    HELD=$($PSQL -Atc "SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=$MIGRATION_LOCK_KEY AND granted" 2>/dev/null || echo 0)
    if [ -n "$HELD" ] && [ "$HELD" != "0" ]; then
      LOCK_HELD=1
      break
    fi
    if ! kill -0 "$LOCK_PID" 2>/dev/null; then
      break
    fi
    [ "$w" -eq 0 ] || [ $((w % 30)) -ne 0 ] || echo "  waiting for migration lock (${w}s)..."
    sleep 1
    w=$((w + 1))
  done
  if [ "$LOCK_HELD" -eq 1 ]; then
    echo "Migration lock acquired (key $MIGRATION_LOCK_KEY)."
  else
    echo "WARNING: could not acquire migration advisory lock; continuing unserialised." >&2
  fi

  release_lock() {
    if [ -n "$LOCK_PID" ]; then
      kill "$LOCK_PID" 2>/dev/null || true
      wait "$LOCK_PID" 2>/dev/null || true
    fi
  }

  # ── Migrationen anwenden ────────────────────────────────────────
  # Einheitliche Sortierung: LC_ALL=C, also reine Byte-Reihenfolge. Bei den
  # vierstellig nullgepolsterten Präfixen ist das numerisch korrekt und
  # zugleich bit-identisch zu `Array.prototype.sort()` in
  # packages/db/src/migrate-all.ts. Damit wenden Produktion, CI, Dev und DR
  # dieselbe Reihenfolge an (S09-15, S13-21) — anders als früher, wo der
  # Entrypoint `sort -V`, CI `sort` und der Runner `.sort()` benutzte.
  # ── Applied-State-Ledger (S09-06, S13-21) ───────────────────────
  # Vorher fuehrte niemand Buch: drizzle/meta/_journal.json deckte 25 von 357
  # Dateien ab, und dieser Entrypoint spielte bei JEDEM Containerstart das
  # ganze Verzeichnis erneut ein. Idempotenz war damit Voraussetzung, ist aber
  # nicht durchgaengig gegeben (0285 legt einen Trigger an, 0306 eine Policy —
  # beide ohne Guard). Sichtbar wurde das nie, weil ON_ERROR_STOP=0 den Fehler
  # verschluckte. Mit dem Ledger laeuft jede Datei genau einmal.
  $PSQL -v ON_ERROR_STOP=1 -q -c "
    CREATE TABLE IF NOT EXISTS _arctos_migrations (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      applied_by  TEXT NOT NULL DEFAULT 'entrypoint',
      status      TEXT NOT NULL DEFAULT 'applied'
    )" >/dev/null

  LEDGER_COUNT=$($PSQL -Atc "SELECT count(*) FROM _arctos_migrations")
  HAS_APP_SCHEMA=$($PSQL -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('organization','user','risk')")

  # Adoption: Eine bereits deployte Datenbank hat kein Ledger, ist aber das
  # Ergebnis vieler frueherer Laeufe. Dort wuerde ein strikter Neuanlauf an
  # "already exists" scheitern. In diesem einen Fall gilt ein Fehler der Form
  # "already exists" als Beleg, dass die Datei ihre Wirkung bereits hat: sie
  # wird als adopted verbucht statt den Deploy zu blockieren. Jeder andere
  # Fehler bleibt fatal. Ab dem zweiten Start greift ausschliesslich das
  # Ledger.  Abschaltbar mit MIGRATION_ADOPT_EXISTING=false.
  ADOPT=0
  if [ "$LEDGER_COUNT" = "0" ] && [ "$HAS_APP_SCHEMA" != "0" ] && [ "$MIGRATION_ADOPT_EXISTING" = "true" ]; then
    ADOPT=1
    echo "NOTE: existing database without migration ledger detected — adoption run."
    echo "      'already exists' errors are recorded as adopted; every other error is fatal."
  fi

  MIGRATION_ERR="/tmp/arctos-migration-errors.$$"
  : >"$MIGRATION_ERR"
  APPLIED_TOTAL=0
  PENDING_LIST="/tmp/arctos-migration-pending.$$"
  NEXT_LIST="/tmp/arctos-migration-next.$$"

  if [ -d "$MIGRATION_DIR" ]; then
    LC_ALL=C ls "$MIGRATION_DIR"/0*.sql 2>/dev/null | LC_ALL=C sort >"$PENDING_LIST"
  else
    : >"$PENDING_LIST"
    echo "FATAL: migration directory $MIGRATION_DIR does not exist." >&2
    release_lock
    exit 1
  fi

  TOTAL=$(wc -l <"$PENDING_LIST" | tr -d ' ')

  # Bereits verbuchte Dateien herausfiltern.
  APPLIED_LIST="/tmp/arctos-migration-applied.$$"
  $PSQL -Atc "SELECT filename FROM _arctos_migrations" >"$APPLIED_LIST" 2>/dev/null || : >"$APPLIED_LIST"
  TODO_LIST="/tmp/arctos-migration-todo.$$"
  : >"$TODO_LIST"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if grep -Fxq "$(basename "$f")" "$APPLIED_LIST" 2>/dev/null; then
      continue
    fi
    echo "$f" >>"$TODO_LIST"
  done <"$PENDING_LIST"
  mv "$TODO_LIST" "$PENDING_LIST"
  PENDING=$(wc -l <"$PENDING_LIST" | tr -d ' ')
  SKIPPED=$((TOTAL - PENDING))

  echo "Applying migrations from $MIGRATION_DIR: $TOTAL files, $SKIPPED already applied, $PENDING pending (max $MIGRATION_PASSES passes)..."

  PASS=1
  while [ "$PASS" -le "$MIGRATION_PASSES" ]; do
    : >"$NEXT_LIST"
    PASS_OK=0
    PASS_FAIL=0
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      BASE=$(basename "$f")
      SUM=$(sha256sum "$f" 2>/dev/null | cut -d' ' -f1)
      [ -n "$SUM" ] || SUM="unknown"
      if ERR=$($PSQL -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 >/dev/null); then
        PASS_OK=$((PASS_OK + 1))
        APPLIED_TOTAL=$((APPLIED_TOTAL + 1))
        $PSQL -q -c "INSERT INTO _arctos_migrations (filename, checksum, applied_by, status)
                     VALUES ('$BASE', '$SUM', 'entrypoint', 'applied')
                     ON CONFLICT (filename) DO NOTHING" >/dev/null 2>&1 || true
      elif [ "$ADOPT" -eq 1 ] && echo "$ERR" | grep -q "already exists"; then
        PASS_OK=$((PASS_OK + 1))
        echo "  adopted (objects already present): $BASE" >&2
        printf '%s\n%s\n\n' "MIGRATION ADOPTED: $f" "$ERR" >>"$MIGRATION_ERR"
        $PSQL -q -c "INSERT INTO _arctos_migrations (filename, checksum, applied_by, status)
                     VALUES ('$BASE', '$SUM', 'entrypoint', 'adopted')
                     ON CONFLICT (filename) DO NOTHING" >/dev/null 2>&1 || true
      else
        PASS_FAIL=$((PASS_FAIL + 1))
        echo "$f" >>"$NEXT_LIST"
        # stderr wird NICHT verworfen (S13-03). Sie ist die einzige Grundlage
        # für die Post-Mortem-Analyse eines fehlgeschlagenen Deploys.
        printf '%s\n%s\n\n' "MIGRATION FAILED: $f" "$ERR" >>"$MIGRATION_ERR"
      fi
    done <"$PENDING_LIST"

    echo "  Pass $PASS: $PASS_OK applied, $PASS_FAIL deferred"
    cp "$NEXT_LIST" "$PENDING_LIST"
    if [ "$PASS_FAIL" -eq 0 ]; then
      break
    fi
    PASS=$((PASS + 1))
  done

  REMAINING=$(wc -l <"$PENDING_LIST" | tr -d ' ')
  release_lock

  if [ "$REMAINING" -ne 0 ]; then
    echo "" >&2
    echo "FATAL: $REMAINING of $TOTAL migrations could not be applied." >&2
    echo "The application is NOT started; the previously deployed version keeps" >&2
    echo "running (ADR-023 §1: strict mode, forward-only, no silent partial" >&2
    echo "schema). Errors of the final pass:" >&2
    echo "" >&2
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      echo "  - $f" >&2
    done <"$PENDING_LIST"
    echo "" >&2
    echo "--- full psql output of every failed attempt ---" >&2
    cat "$MIGRATION_ERR" >&2
    rm -f "$MIGRATION_ERR" "$PENDING_LIST" "$NEXT_LIST" "$APPLIED_LIST"
    exit 1
  fi

  rm -f "$MIGRATION_ERR" "$PENDING_LIST" "$NEXT_LIST" "$APPLIED_LIST"
  echo "Migrations complete: $APPLIED_TOTAL applied in this run, $SKIPPED already recorded, $TOTAL total."

  # Seed catalog/reference data whenever RUN_SEEDS=true.
  # Demo organizations are gated separately behind SEED_DEMO_DATA=true so that
  # private tenants don't receive Meridian/Arctis test orgs by default.
  if [ "$RUN_SEEDS" = "true" ] && [ -d "/app/packages/db/sql" ]; then
    echo "Seeding catalog data..."
    SEED_FAILED=0
    for f in /app/packages/db/sql/seed_catalog_*.sql /app/packages/db/sql/seed_fachliche_stammdaten.sql /app/packages/db/sql/seed_cross_framework_mappings*.sql; do
      [ -f "$f" ] || continue
      if ! ERR=$($PSQL -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 >/dev/null); then
        SEED_FAILED=$((SEED_FAILED + 1))
        # Seeds sind Referenzdaten, kein Schema: ein Fehlschlag wird laut
        # gemeldet, bricht den Start aber nicht ab.
        echo "WARNING: seed failed: $f" >&2
        echo "$ERR" >&2
      fi
    done
    if [ "$SEED_DEMO_DATA" = "true" ]; then
      # #SEC-F04: Demo/RBAC-test accounts ship with KNOWN passwords
      # (admin@arctos.dev, *@arctistx.test, ...). Seeding them onto a
      # production instance that holds real data is unacceptable. Refuse
      # unless the operator explicitly opts in via ALLOW_DEMO_SEED_IN_PROD.
      # Dev/CI (NODE_ENV != production) is unaffected.
      if [ "$NODE_ENV" = "production" ] && [ "$ALLOW_DEMO_SEED_IN_PROD" != "true" ]; then
        echo "WARNING: refusing to seed demo/test accounts in production; set ALLOW_DEMO_SEED_IN_PROD=true to override (SEED_DEMO_DATA=true was set)."
      else
        echo "Seeding demo data (SEED_DEMO_DATA=true)..."
        for f in /app/packages/db/sql/seed_demo_*.sql; do
          [ -f "$f" ] || continue
          if ! ERR=$($PSQL -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 >/dev/null); then
            SEED_FAILED=$((SEED_FAILED + 1))
            echo "WARNING: demo seed failed: $f" >&2
            echo "$ERR" >&2
          fi
        done
      fi
    else
      echo "Skipping demo data (SEED_DEMO_DATA != true)."
    fi
    echo "Seed complete ($SEED_FAILED failed)."
  fi
else
  echo "Skipping migrations (DATABASE_URL not set or psql not available)."
fi

# ─────────────────────────────────────────────────────────────────
# Start the application
# ─────────────────────────────────────────────────────────────────
echo "Starting ARCTOS on port ${PORT:-3000}..."
exec "$@"
