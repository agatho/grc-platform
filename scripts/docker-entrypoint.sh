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

  # Run custom SQL migrations
  if [ -d "/app/packages/db/drizzle" ]; then
    MIGRATED=0
    for f in $(ls /app/packages/db/drizzle/0*.sql 2>/dev/null | sort); do
      PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
      MIGRATED=$((MIGRATED + 1))
    done
    echo "Applied $MIGRATED migration files."
  fi

  # Run seed files if RUN_SEEDS=true
  if [ "$RUN_SEEDS" = "true" ] && [ -d "/app/packages/db/sql" ]; then
    echo "Seeding catalog data..."
    for f in /app/packages/db/sql/seed_catalog_*.sql /app/packages/db/sql/seed_fachliche_stammdaten.sql /app/packages/db/sql/seed_cross_framework_mappings*.sql; do
      [ -f "$f" ] || continue
      PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
    done
    echo "Seeding demo data..."
    for f in /app/packages/db/sql/seed_demo_*.sql; do
      [ -f "$f" ] || continue
      PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
    done
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
