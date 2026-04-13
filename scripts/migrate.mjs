#!/usr/bin/env node
/**
 * scripts/migrate.mjs
 *
 * Runs all pending Drizzle migrations against the DATABASE_URL.
 * Called by docker-entrypoint.sh before the Next.js server starts.
 *
 * Usage: node scripts/migrate.mjs
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = join(__dirname, "..", "drizzle")

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[migrate] ERROR: DATABASE_URL is not set")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })

console.log("[migrate] Running migrations…")

try {
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder })
  console.log("[migrate] Migrations complete ✓")
} catch (err) {
  console.error("[migrate] Migration failed:", err)
  process.exit(1)
} finally {
  await pool.end()
}
