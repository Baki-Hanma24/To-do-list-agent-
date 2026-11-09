import path from "path";
import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

const g = globalThis as unknown as { __db?: Promise<DB> };

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Neon Postgres (production). Run `npm run db:migrate` on deploy.
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema }) as unknown as DB;
  }
  // Local: embedded Postgres (PGlite) on disk, auto-migrated.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const client = dir === "memory" ? new PGlite() : new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__db) g.__db = create();
  return g.__db;
}

export { schema };
