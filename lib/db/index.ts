import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

/**
 * Single shared connection pool for the entire app.
 * Reused across hot-reloads in development via the global cache.
 */
const globalForDb = globalThis as unknown as { pool: Pool | undefined }

const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool
}

export const db = drizzle(pool, { schema })

export type DB = typeof db
