#!/bin/sh
set -e

echo "[Docker Entrypoint] Waiting for database to be ready..."
# Run Prisma db push to ensure schema is synced with PostgreSQL
echo "[Docker Entrypoint] Running Prisma DB Push..."
npx prisma db push --skip-generate --accept-data-loss

echo "[Docker Entrypoint] Starting Backend Application..."
exec "$@"
