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

  # Run schema migrations. Since the 2026-04-20 consolidation commit
  # (3cb6cdc) there is exactly one source of truth: packages/db/drizzle/.
  # The old src/migrations/ tree was archived; every file was carried
  # forward into drizzle/ with a fresh sequential number so a fresh
  # database only needs one pass through this directory.
  #
  # Files are sorted numerically by the leading digits so ALTER-on-
  # earlier-tables runs after the corresponding CREATE. stderr is
  # redirected to /dev/null because ~37 files fail with schema-drift
  # errors that are documented in packages/db/MIGRATIONS_KNOWN_ISSUES.md —
  # the app tolerates those tables being missing for now.
  MIGRATED_COUNT=0
  MIGRATED_FAILED=0
  if [ -d "/app/packages/db/drizzle" ]; then
    for f in $(ls /app/packages/db/drizzle/0*.sql 2>/dev/null | sort -V); do
      if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 -f "$f" >/dev/null 2>&1; then
        MIGRATED_COUNT=$((MIGRATED_COUNT + 1))
      else
        MIGRATED_FAILED=$((MIGRATED_FAILED + 1))
      fi
    done
  fi
  echo "Applied $MIGRATED_COUNT migration files ($MIGRATED_FAILED failed; see MIGRATIONS_KNOWN_ISSUES.md)."

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
