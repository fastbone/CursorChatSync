#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" > /dev/null 2>&1; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready!"

echo "Running database migrations..."
# Check if we're in dev mode (ts-node available in node_modules) or prod mode
if [ -f "node_modules/.bin/ts-node" ] || command -v ts-node >/dev/null 2>&1; then
  echo "Running migrations in development mode..."
  npm run migrate
elif [ -f "dist/db/migrations/runMigrations.js" ]; then
  echo "Running migrations in production mode..."
  node dist/db/migrations/runMigrations.js
else
  echo "Warning: Could not find migration runner. Skipping migrations."
fi

echo "Starting server..."
exec "$@"
