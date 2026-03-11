#!/bin/sh
set -e

# ─── Wait for Postgres ────────────────────────────────────────────────────────
# Parse host/port/user from DATABASE_URL (postgresql://user:pass@host:port/db)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:]+):([0-9]+)/.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*@[^:]+:([0-9]+)/.*|\1|')
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')

echo "⏳ Waiting for Postgres at $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q; do
  sleep 1
done
echo "✅ Postgres is ready"

# ─── Run Prisma migrations ────────────────────────────────────────────────────
echo "⏳ Running migrations..."
npx prisma migrate deploy
echo "✅ Migrations complete"

# ─── Seed SQL functions (CREATE OR REPLACE — idempotent) ─────────────────────
echo "⏳ Seeding SQL functions..."
psql "$DATABASE_URL" -f prisma/seed.sql
echo "✅ SQL functions seeded"

# ─── Load reference data (ON CONFLICT DO NOTHING — idempotent) ───────────────
echo "⏳ Loading reference data..."
psql "$DATABASE_URL" -f prisma/data.sql
echo "✅ Reference data loaded"

# ─── Create/ensure system superuser ──────────────────────────────────────────
echo "⏳ Ensuring system superuser..."
AUTO_VERIFY_USER_ID=$(PRINT_ID_ONLY=1 node dist/scripts/create-superuser.js)
export AUTO_VERIFY_USER_ID
echo "✅ System superuser ready (AUTO_VERIFY_USER_ID=$AUTO_VERIFY_USER_ID)"

# ─── Start the app ────────────────────────────────────────────────────────────
echo "🚀 Starting backend..."
exec node dist/index.js
