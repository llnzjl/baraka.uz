import { SQLitePool } from '../db/sqlite.mjs';
import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) loadEnvFile('.env.local');
if (process.env.DATABASE_DRIVER === 'postgres' || (process.env.DATABASE_DRIVER !== 'sqlite' && process.env.DATABASE_URL))
  throw new Error('Existing PostgreSQL configuration found. Follow docs/sqlite.md to import it, or use scripts/local-postgres.mjs.');
if (process.argv[2] === 'stop') {
  console.log('SQLite has no database server to stop. Close the website to release the file.');
} else {
  const db = new SQLitePool();
  console.log(`SQLite ready: ${db.filename}. Start the website with npm run dev.`);
  await db.end();
}
