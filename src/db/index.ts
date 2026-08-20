import { PGlite } from '@electric-sql/pglite';
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { dbDir, migrationsDir } from '@/lib/paths';
import * as schema from './schema';

// Embedded Postgres (PGlite, WASM) stored in <dataDir>/db. Singleton across
// dev HMR; one connection — PGlite serializes queries itself.
type Db = PgliteDatabase<typeof schema>;
const g = globalThis as unknown as { __lifeosDb?: Db; __lifeosMigrated?: Promise<void> };

export function db(): Db {
  if (!g.__lifeosDb) {
    const client = new PGlite(dbDir());
    g.__lifeosDb = drizzle(client, { schema });
  }
  return g.__lifeosDb;
}

// Apply committed migrations (drizzle/). Idempotent; run once per process at boot.
export function migrateDb(): Promise<void> {
  if (!g.__lifeosMigrated) {
    g.__lifeosMigrated = migrate(db(), { migrationsFolder: migrationsDir() })
      .catch((e) => { g.__lifeosMigrated = undefined; throw e; });
  }
  return g.__lifeosMigrated;
}

export * as t from './schema';
