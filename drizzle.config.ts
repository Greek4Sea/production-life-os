import { defineConfig } from 'drizzle-kit';

// Only used by `npm run db:generate` to emit SQL migrations into ./drizzle.
// At runtime the app applies them itself against the embedded PGlite database.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  driver: 'pglite',
  dbCredentials: { url: './.life-os-dev/db' },
});
