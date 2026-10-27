import { Pool } from "pg";
import { SQLitePool, type DatabasePool, type DatabaseClient } from "../../../db/sqlite.mjs";
import { BookingError } from "./validation";
export type { DatabaseClient } from "../../../db/sqlite.mjs";
const globalDb = globalThis as unknown as { bookingPool?: DatabasePool };
export function database() {
  if (globalDb.bookingPool) return globalDb.bookingPool;
  // Existing installs keep their data source until the explicit import/cutover.
  const driver = process.env.DATABASE_DRIVER || (process.env.DATABASE_URL || process.env.BARAKA_EDGE === "true" ? "postgres" : "sqlite");
  if (driver === "sqlite") {
    if (process.env.BARAKA_EDGE === "true") throw new Error("SQLite needs a Node server with persistent local storage; use PostgreSQL on Deno Deploy.");
    globalDb.bookingPool = new SQLitePool();
  } else if (driver === "postgres") {
    if (!process.env.DATABASE_URL) throw new BookingError("UNAVAILABLE", 503);
    globalDb.bookingPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: process.env.BARAKA_EDGE === "true" ? 1 : 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: process.env.BARAKA_EDGE === "true" ? 5000 : 20000,
      statement_timeout: 10000,
      application_name: "baraka-booking",
    }) as unknown as DatabasePool;
  } else throw new Error("DATABASE_DRIVER must be sqlite or postgres.");
  return globalDb.bookingPool;
}
export async function transaction<T>(fn: (client: DatabaseClient) => Promise<T>) {
  const c = await database().connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout='5s'");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
