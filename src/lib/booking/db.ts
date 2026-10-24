import { Pool, PoolClient } from "pg";
import { BookingError } from "./validation";
const globalDb = globalThis as unknown as { bookingPool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL) throw new BookingError("UNAVAILABLE", 503);
  if (!globalDb.bookingPool)
    globalDb.bookingPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 20000,
      statement_timeout: 10000,
      application_name: "baraka-booking",
    });
  return globalDb.bookingPool;
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
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
