import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";
const driver = process.env.DATABASE_DRIVER || (process.env.DATABASE_URL || process.env.MIGRATION_DATABASE_URL ? "postgres" : "sqlite");
if (driver === "sqlite") {
  const { SQLitePool } = await import("../db/sqlite.mjs");
  const database = new SQLitePool();
  console.log(`SQLite schema ready: ${database.filename}`);
  await database.end();
  process.exit(0);
}
if (driver !== "postgres") throw new Error("DATABASE_DRIVER must be sqlite or postgres.");
const connectionString =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("Set MIGRATION_DATABASE_URL or DATABASE_URL.");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(752938112)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS public.booking_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const files = (await readdir(new URL("../db/migrations/", import.meta.url)))
    .filter((x) => x.endsWith(".sql"))
    .sort();
  for (const name of files) {
    const sql = await readFile(
        new URL(`../db/migrations/${name}`, import.meta.url),
        "utf8",
      ),
      // Git checkouts can change line endings on Windows. Compare SQL content
      // consistently while still accepting previously stored raw-file hashes.
      normalized = sql.replace(/\r\n/g, "\n"),
      hash = createHash("sha256").update(normalized).digest("hex"),
      windowsHash = createHash("sha256").update(normalized.replace(/\n/g, "\r\n")).digest("hex");
    const old = (
      await client.query(
        "SELECT checksum FROM public.booking_migrations WHERE name=$1",
        [name],
      )
    ).rows[0];
    if (old) {
      if (old.checksum !== hash && old.checksum !== windowsHash)
        throw new Error(`Migration changed after application: ${name}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO public.booking_migrations(name,checksum) VALUES($1,$2)",
        [name, hash],
      );
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(752938112)");
  await client.end();
}
