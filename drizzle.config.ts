import { defineConfig } from 'drizzle-kit';

// drizzle-kit is used for `generate` only. Migrations are applied to D1 with
// `wrangler d1 migrations apply nusukhelp-db --local | --remote`, which reads
// them from the migrations_dir declared in wrangler.jsonc.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
});
