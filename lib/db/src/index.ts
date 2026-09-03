import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env files from common locations
const paths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), "../../lib/db/.env"),
];

for (const p of paths) {
  const result = config({ path: p });
  if (!result.error) break;
}

const { Pool } = pg;

/**
 * Any Drizzle Postgres database bound to this package's schema.
 * Production binds node-postgres; tests inject a PGlite instance via `setDb`.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let activeDb: Db | undefined;

/** Point the shared `db` export at a different Drizzle instance (test harness only). */
export function setDb(instance: Db): void {
  activeDb = instance;
}

/** The Drizzle instance currently backing the shared `db` export. */
export function getDb(): Db {
  if (!activeDb) {
    throw new Error(
      "No database is configured: set DATABASE_URL, or call setDb() when DB_DRIVER=injected",
    );
  }
  return activeDb;
}

/**
 * Driver selection. Unset (production, dev, Lambda) keeps the original behaviour:
 * a node-postgres pool bound to DATABASE_URL, created eagerly at import time.
 * `DB_DRIVER=injected` skips the real connection entirely so a test harness can
 * supply its own instance through `setDb()` before the first query.
 */
const useInjectedDriver = process.env.DB_DRIVER === "injected";

if (!useInjectedDriver && !process.env.DATABASE_URL) {
  throw new Error(
    `DATABASE_URL is not set. Looked for .env files at: ${paths.join(", ")}`,
  );
}

export const pool: pg.Pool | undefined = useInjectedDriver
  ? undefined
  : new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("rds.amazonaws.com")
        ? { rejectUnauthorized: false }
        : undefined,
    });

if (pool) {
  setDb(drizzle(pool, { schema }));
}

/**
 * Shared database handle. A proxy that forwards every property access to the
 * active instance, so `import { db } from "@workspace/db"` call sites keep
 * working unchanged whether the backing driver is node-postgres or a test double.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    const instance = getDb();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export * from "./schema";
