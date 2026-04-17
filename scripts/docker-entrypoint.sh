#!/bin/sh
# ============================================================================
# ARCTOS Docker Entrypoint
# Runs database migrations on startup, then starts the application
# ============================================================================
set -e

echo "ARCTOS GRC Platform starting..."

# ─────────────────────────────────────────────────────────────────
# Run migrations if DATABASE_URL is set and psql is available
# ─────────────────────────────────────────────────────────────────
if [ -n "$DATABASE_URL" ] && command -v psql >/dev/null 2>&1; then
  echo "Running database migrations..."

  # Extract connection details from DATABASE_URL
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

  # Wait for PostgreSQL
  echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
  for i in $(seq 1 30); do
    if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
      echo "PostgreSQL ready."
      break
    fi
    sleep 1
  done

  # Ensure required extensions exist
  echo "Ensuring required PostgreSQL extensions..."
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true

  # Run schema migrations in two passes (F-17):
  #   1. packages/db/drizzle/0*.sql  — drizzle-kit generated migrations
  #   2. packages/db/src/migrations/*.sql — feature-specific hand-written
  #      migrations (Sprint 67+ Copilot, Tax CMS, Horizon, Cert Wizard,
  #      BI Reporting, …) that were previously only applied in dev.
  # Both directories must be sorted numerically by the leading digits of
  # the filename so that dependency order is preserved. stderr is kept
  # on the visible stream to surface enum violations or FK errors that
  # would otherwise be swallowed by `|| true`.
  MIGRATED_DRIZZLE=0
  MIGRATED_MANUAL=0
  if [ -d "/app/packages/db/drizzle" ]; then
    for f in $(ls /app/packages/db/drizzle/0*.sql 2>/dev/null | sort -V); do
      if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 -f "$f" >/dev/null 2>&1; then
        :
      fi
      MIGRATED_DRIZZLE=$((MIGRATED_DRIZZLE + 1))
    done
  fi
  if [ -d "/app/packages/db/src/migrations" ]; then
    for f in $(ls /app/packages/db/src/migrations/*.sql 2>/dev/null | sort -V); do
      if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 -f "$f" >/dev/null 2>&1; then
        :
      fi
      MIGRATED_MANUAL=$((MIGRATED_MANUAL + 1))
    done
  fi
  echo "Applied $MIGRATED_DRIZZLE drizzle + $MIGRATED_MANUAL manual migration files."

  # Seed catalog/reference data whenever RUN_SEEDS=true.
  # Demo organizations are gated separately behind SEED_DEMO_DATA=true so that
  # private tenants don't receive Meridian/Arctis test orgs by default.
  if [ "$RUN_SEEDS" = "true" ] && [ -d "/app/packages/db/sql" ]; then
    echo "Seeding catalog data..."
    for f in /app/packages/db/sql/seed_catalog_*.sql /app/packages/db/sql/seed_fachliche_stammdaten.sql /app/packages/db/sql/seed_cross_framework_mappings*.sql; do
      [ -f "$f" ] || continue
      PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
    done
    if [ "$SEED_DEMO_DATA" = "true" ]; then
      echo "Seeding demo data (SEED_DEMO_DATA=true)..."
      for f in /app/packages/db/sql/seed_demo_*.sql; do
        [ -f "$f" ] || continue
        PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
      done
    else
      echo "Skipping demo data (SEED_DEMO_DATA != true)."
    fi
    echo "Seed complete."
  fi
else
  echo "Skipping migrations (DATABASE_URL not set or psql not available)."
fi

# ─────────────────────────────────────────────────────────────────
# Start the application
# ─────────────────────────────────────────────────────────────────
echo "Starting ARCTOS on port ${PORT:-3000}..."
exec "$@"
