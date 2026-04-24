#!/bin/sh
set -e

echo "=== Alliance CRM — Starting ==="

# ── Wait for PostgreSQL ──
echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL is ready."

# ── Run schema ──
echo "Applying database schema..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /app/backend/db/schema.sql -q 2>&1 | grep -i error || true

# ── Run seed (only if users table is empty) ──
USER_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM users" 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ]; then
  echo "Seeding initial data..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /app/backend/db/seed.sql -q 2>&1 | grep -i error || true

  echo "Running migrations..."
  for migration in /app/backend/db/migration_*.js; do
    if [ -f "$migration" ]; then
      echo "  Running $(basename $migration)..."
      node "$migration" 2>&1 | tail -1
    fi
  done

  echo "Running full seed..."
  node /app/backend/db/seed_full.js 2>&1 | tail -5
  echo "Database seeded."
else
  echo "Database already has data ($USER_COUNT users). Running migrations only..."
  for migration in /app/backend/db/migration_*.js; do
    if [ -f "$migration" ]; then
      node "$migration" 2>&1 | tail -1 || true
    fi
  done
fi

echo "=== Starting server on port ${BACKEND_PORT:-3000} ==="
exec "$@"
