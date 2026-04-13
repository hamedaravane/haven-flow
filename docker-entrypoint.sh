#!/bin/sh
# docker-entrypoint.sh
# Runs DB migrations, then starts the Next.js standalone server.
set -e

echo "=== HavenFlow startup ==="

# Run DB migrations before accepting traffic
echo "[entrypoint] Running database migrations…"
node /app/scripts/migrate.mjs

echo "[entrypoint] Starting Next.js server…"
exec node /app/server.js
