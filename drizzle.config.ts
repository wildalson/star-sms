import { defineConfig } from 'drizzle-kit';

try { process.loadEnvFile(); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error('Set DATABASE_URL in .env before configuring PostgreSQL.');

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/schema.ts',
  dbCredentials: { url },
});
