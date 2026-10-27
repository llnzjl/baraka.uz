import {
  createOrder,
  orderCatalog,
  guestOrders,
  adminOrders,
  changeOrderStatus,
} from "../src/lib/orders/engine";
import { changeGuestName, sessionView } from "../src/lib/booking/guest-profile";
import { syncRecords } from "../src/lib/booking/records";
import { saveMenuItem, menuImage, publicMenu } from "../src/lib/menu/engine";
import { POST as signIn, GET as sessionStatus, DELETE as signOut } from "../src/app/api/session/route";
import path from "node:path";
import { unlink } from "node:fs/promises";
import {
  newSession,
  updateOwnerProfileFromSession,
  changeOwnerPasswordFromSession,
  endSession,
  readSession,
  verifyOwner,
  credentialVersion,
} from "../src/lib/booking/sessions";
import { scryptSync } from "node:crypto";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { database } from "../src/lib/booking/db";
import {
  availability,
  createReservation,
  updateReservation,
  updateOrderedItems,
  purgeExpired,
  getConfig,
  saveConfig,
} from "../src/lib/booking/engine";
import { processNotifications } from "../src/lib/booking/notifications";
import {
  bookingSchema,
  seoulDate,
  instant,
} from "../src/lib/booking/validation";
const sqlite = process.env.TEST_SQLITE === "true";
const sqliteFile = path.resolve(".test-db", "sqlite-" + randomUUID() + ".sqlite");
const url = process.env.TEST_DATABASE_URL;
if (
  !sqlite && (!url ||
  process.env.ALLOW_TEST_DB_RESET !== "true" ||
  !new URL(url).pathname.endsWith("_test"))
)
  throw new Error(
    "Use a disposable database ending _test and ALLOW_TEST_DB_RESET=true.",
  );
process.env.DATABASE_DRIVER = sqlite ? "sqlite" : "postgres";
if (sqlite) process.env.SQLITE_PATH = sqliteFile;
else process.env.DATABASE_URL = url;
const initialOwnerSalt = "a".repeat(64);
process.env.OWNER_USERNAME = "test-owner";
process.env.OWNER_PASSWORD_HASH = `${initialOwnerSalt}:${scryptSync("test-password", initialOwnerSalt, 64).toString("hex")}`;
const recordsPath = path.resolve(".test-db", `records-${randomUUID()}.txt`);
process.env.RESERVATION_RECORDS_PATH = recordsPath;
const ordersPath = path.resolve(".test-db", `orders-${randomUUID()}.txt`);
process.env.ORDERS_RECORDS_PATH = ordersPath;
const historyPath = path.resolve(".test-db", `history-${randomUUID()}.txt`);
process.env.HISTORY_RECORDS_PATH = historyPath;
const receiptsPath = path.resolve(".test-db", `receipts-${randomUUID()}.txt`);
process.env.RECEIPTS_RECORDS_PATH = receiptsPath;
process.env.OWNER_EMAIL = "owner@example.invalid";
process.env.RESEND_API_KEY = "test-only";
process.env.RESEND_FROM = "test@example.invalid";
const date = seoulDate(new Date(Date.now() + 3 * 86400000));
const actor = randomUUID();
function input(extra: Record<string, unknown> = {}) {
  return bookingSchema.parse({
    date,
    time: "12:00",
    guests: 2,
    name: "TEST ONLY",
    phone: "01012345678",
    consent: true,
    adult: true,
    privacyVersion: "1",
    idempotencyKey: randomUUID(),
    ...extra,
  });
}
before(async () => {
  if (sqlite) { database(); return; }
  await database().query("DROP SCHEMA IF EXISTS booking CASCADE");
  await database().query(
    await readFile("db/migrations/001_reservations.sql", "utf8"),
  );
  await database().query(
    await readFile("db/migrations/002_entry_sessions.sql", "utf8"),
  );
  await database().query(
    await readFile("db/migrations/003_reservation_records.sql", "utf8"),
  );
  await database().query(
    await readFile("db/migrations/004_guest_names.sql", "utf8"),
  );
  await database().query(
    await readFile("db/migrations/005_table_orders.sql", "utf8"),
  );
  await database().query(await readFile("db/migrations/006_order_receipts.sql", "utf8"));
  await database().query(await readFile("db/migrations/007_restaurant_menu.sql", "utf8"));
  await database().query(await readFile("db/migrations/008_owner_credentials.sql", "utf8"));
  await database().query(await readFile("db/migrations/009_customer_accounts.sql", "utf8"));
  await database().query(await readFile("db/migrations/010_owner_email_challenges.sql", "utf8"));
  await database().query(await readFile("db/migrations/011_owner_password_resets.sql", "utf8"));
  await database().query(await readFile("db/migrations/012_owner_profile.sql", "utf8"));
  await database().query(await readFile("db/migrations/013_owner_email.sql", "utf8"));
  await database().query(await readFile("db/migrations/014_remove_owner_email_auth.sql", "utf8"));
  await database().query(await readFile("db/migrations/015_edge_records_snapshot.sql", "utf8"));
  await database().query(await readFile("db/migrations/016_daily_guest_numbers.sql", "utf8"));
});
after(async () => {
  await database().end();
  if (sqlite) for (const suffix of ["", "-wal", "-shm"]) await unlink(sqliteFile + suffix).catch(() => {});
  await unlink(recordsPath).catch(() => {});
  await unlink(ordersPath).catch(() => {});
  await unlink(historyPath).catch(() => {});
  await unlink(receiptsPath).catch(() => {});
});
async function reset() {
  await database().query("DELETE FROM booking.entry_sessions");
  await newSession("owner");
  if (sqlite) {
    const c = await database().connect();
    try {
      await c.query("BEGIN");
      for (const table of ["audit_log","order_receipts","dining_orders","table_allocations","notifications","reservations","dining_tables","opening_hours","closed_dates"])
        await c.query("DELETE FROM booking." + table);
      await c.query("COMMIT");
    } finally { c.release(); }
  } else await database().query(
    "TRUNCATE booking.reservations,booking.table_allocations,booking.notifications,booking.audit_log,booking.dining_tables,booking.opening_hours,booking.closed_dates CASCADE",
  );
  await database().query(
    "UPDATE booking.restaurant_config SET enabled=true,dining_minutes=90,slot_minutes=30,min_notice_minutes=0,advance_days=60,max_party=8,max_concurrent_guests=8,daily_booking_limit=100,auto_confirm=true WHERE id=1",
  );
  await database().query(
    "INSERT INTO booking.dining_tables(name,seats) VALUES('TEST TABLE',4)",
  );
  await database().query(
    "INSERT INTO booking.opening_hours(weekday,opens,closes) VALUES($1,720,960)",
    [new Date(`${date}T12:00:00Z`).getUTCDay()],
  );
}
test("fresh migration is closed and contains no invented capacity", async () => {
  const a = await availability(date, 2);
  assert.equal(a.enabled, false);
  assert.deepEqual(a.slots, []);
});

test("menu changes persist prices, visibility and image bytes across updates", async () => {
  const bytes = Buffer.from([0, 255, 2, 128]);
  const input = { id: "storage-test-dish", name: "Storage test", ko: "Storage test", category: "mains", price: 1000 };
  const created = await saveMenuItem(input, actor, { bytes, type: "image/png" });
  assert.equal(created.price, 1000);
  assert.deepEqual((await menuImage(created.id)).bytes, bytes);
  const updated = await saveMenuItem({ ...input, price: 2000, active: false }, actor);
  assert.equal(updated.price, 2000);
  assert.equal(updated.active, false);
  assert.equal((await publicMenu()).some(item => item.id === created.id), false);
  await assert.rejects(menuImage(created.id), /NOT_FOUND/);
});
test("20 concurrent reservations on one table yield exactly one committed booking", async () => {
  await reset();
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => createReservation(input())),
  );
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (
      await database().query(
        "SELECT count(*)::int AS n FROM booking.reservations",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await database().query(
        "SELECT count(*)::int AS n FROM booking.notifications",
      )
    ).rows[0].n,
    1,
  );
});
test("database exclusion constraint rejects overlap even outside the booking engine", async () => {
  await reset();
  await createReservation(input());
  const second = await createReservation(input({ time: "14:00" }));
  const r = (
    await database().query(
      "SELECT id FROM booking.reservations WHERE reference=$1",
      [second.reference],
    )
  ).rows[0];
  await assert.rejects(
    database().query(
      "UPDATE booking.table_allocations SET starts_at=$2,ends_at=$3 WHERE reservation_id=$1",
      [r.id, instant(date, 720), instant(date, 810)],
    ),
    (e: any) => e.code === "23P01",
  );
});
test("same idempotency key concurrently returns the same receipt without duplicate emails", async () => {
  await reset();
  const v = input();
  const result = await Promise.all(
    Array.from({ length: 8 }, () => createReservation(v)),
  );
  assert.equal(new Set(result.map((r) => r.reference)).size, 1);
  assert.equal(
    (
      await database().query(
        "SELECT count(*)::int AS n FROM booking.notifications",
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    createReservation({ ...v, name: "Changed" }),
    /IDEMPOTENCY_CONFLICT/,
  );
});
test("cancellation frees capacity, emits notification and enforces version/status transitions", async () => {
  await reset();
  await createReservation(input());
  const r = (await database().query("SELECT * FROM booking.reservations"))
    .rows[0];
  assert.equal((await availability(date, 2)).slots.includes("12:00"), false);
  await assert.rejects(
    updateReservation(r.id, "completed", 1, actor),
    /TOO_EARLY/,
  );
  await updateReservation(r.id, "cancelled", 1, actor);
  assert.equal((await availability(date, 2)).slots.includes("12:00"), true);
  await assert.rejects(
    updateReservation(r.id, "confirmed", 1, actor),
    /STALE_VERSION/,
  );
  await assert.rejects(
    updateReservation(r.id, "confirmed", 2, actor),
    /INVALID_TRANSITION/,
  );
  assert.equal(
    (
      await database().query(
        "SELECT count(*)::int AS n FROM booking.notifications",
      )
    ).rows[0].n,
    2,
  );
});
test("closures, outside hours, past dates, full room and per-table seating capacities", async () => {
  await reset();
  await assert.rejects(
    createReservation(input({ time: "11:30" })),
    /SLOT_UNAVAILABLE/,
  );
  await assert.rejects(
    createReservation(input({ date: "2000-01-01" })),
    /SLOT_UNAVAILABLE/,
  );
  await assert.rejects(
    createReservation(input({ guests: 5 })),
    /SLOT_UNAVAILABLE/,
  );
  await database().query("INSERT INTO booking.closed_dates(date) VALUES($1)", [
    date,
  ]);
  assert.deepEqual((await availability(date, 2)).slots, []);
  await assert.rejects(createReservation(input()), /SLOT_UNAVAILABLE/);
  await database().query("DELETE FROM booking.closed_dates");
  await database().query(
    "UPDATE booking.restaurant_config SET max_concurrent_guests=1",
  );
  assert.deepEqual((await availability(date, 2)).slots, []);
});
test("stored UTC timestamps and adjacent seating periods", async () => {
  await reset();
  await createReservation(input());
  const r = (await database().query("SELECT * FROM booking.reservations"))
    .rows[0];
  assert.equal(r.starts_at.toISOString(), instant(date, 720).toISOString());
  assert.equal(r.ends_at.toISOString(), instant(date, 810).toISOString());
  await createReservation(input({ time: "13:30" }));
  assert.equal(
    (
      await database().query(
        "SELECT count(*)::int AS n FROM booking.reservations",
      )
    ).rows[0].n,
    2,
  );
});
test("pending consumes capacity; confirmation and cancellation queue distinct events", async () => {
  await reset();
  await database().query(
    "UPDATE booking.restaurant_config SET auto_confirm=false",
  );
  assert.equal((await createReservation(input())).status, "pending");
  assert.equal((await availability(date, 2)).slots.includes("12:00"), false);
  const r = (await database().query("SELECT * FROM booking.reservations"))
    .rows[0];
  await updateReservation(r.id, "confirmed", 1, actor);
  assert.equal(
    (
      await database().query(
        "SELECT count(*)::int AS n FROM booking.notifications",
      )
    ).rows[0].n,
    2,
  );
});
test("email failure cannot undo booking; retry uses stable Resend idempotency key", async () => {
  await reset();
  await createReservation(input());
  const original = globalThis.fetch;
  const keys: string[] = [];
  try {
    globalThis.fetch = async (_url, options) => {
      keys.push(
        (options?.headers as Record<string, string>)["Idempotency-Key"],
      );
      return new Response("{}", { status: 503 });
    };
    assert.equal((await processNotifications()).failed, 1);
    assert.equal(
      (await database().query("SELECT status FROM booking.reservations"))
        .rows[0].status,
      "confirmed",
    );
    await database().query(
      "UPDATE booking.notifications SET available_at=now()",
    );
    globalThis.fetch = async (_url, options) => {
      keys.push(
        (options?.headers as Record<string, string>)["Idempotency-Key"],
      );
      return new Response(JSON.stringify({ id: "test-provider-id" }), {
        status: 200,
      });
    };
    assert.equal((await processNotifications()).sent, 1);
    assert.equal(keys[0], keys[1]);
    assert.equal(
      (await database().query("SELECT status FROM booking.notifications"))
        .rows[0].status,
      "sent",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("retention cascades through allocations and notifications", async () => {
  await reset();
  await createReservation(input());
  await database().query(
    "UPDATE booking.reservations SET purge_at=now()-interval '1 second'",
  );
  assert.equal((await purgeExpired()).deleted, 1);
  for (const table of ["reservations", "table_allocations", "notifications"])
    assert.equal(
      (
        await database().query(
          `SELECT count(*)::int AS n FROM booking.${table}`,
        )
      ).rows[0].n,
      0,
    );
});

test("safe capacity changes preserve bookings and unsafe closures are rejected", async () => {
  await reset();
  await createReservation(input());
  const raw = await getConfig();
  const { id, updated_at, ...config } = raw;
  await saveConfig({ ...config, enabled: false }, actor);
  assert.equal((await availability(date, 2)).enabled, false);
  await assert.rejects(
    saveConfig(
      { ...config, closures: [{ date, reason: "Test closure" }] },
      actor,
    ),
    /ACTIVE_BOOKINGS_CONFIG_LOCKED/,
  );
});

test("runtime role can read booking data but cannot grant admin access", { skip: sqlite }, async () => {
  const c = await database().connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE booking_app");
    await c.query("SELECT id FROM booking.restaurant_config");
    await assert.rejects(
      c.query(
        "INSERT INTO booking.admin_users(user_id,role) VALUES($1,'manager')",
        [randomUUID()],
      ),
      (e: any) => e.code === "42501",
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});
test("untrusted role cannot read private booking schema", { skip: sqlite }, async () => {
  const c = await database().connect();
  try {
    await c.query(
      "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='booking_untrusted_test') THEN CREATE ROLE booking_untrusted_test NOLOGIN; END IF; END $$",
    );
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE booking_untrusted_test");
    await assert.rejects(
      c.query("SELECT * FROM booking.reservations"),
      (e: any) => e.code === "42501",
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});
test("simultaneous workers do not deliver the same claimed job twice", async () => {
  await reset();
  await createReservation(input());
  const original = globalThis.fetch;
  let deliveries = 0;
  try {
    globalThis.fetch = async () => {
      deliveries++;
      await new Promise((r) => setTimeout(r, 50));
      return new Response(JSON.stringify({ id: "test-lease-id" }), {
        status: 200,
      });
    };
    await Promise.all([processNotifications(), processNotifications()]);
    assert.equal(deliveries, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("bookings remain available with no owner session, after logout and after session expiry", async () => {
  await reset();
  await database().query("DELETE FROM booking.entry_sessions");
  assert.ok((await availability(date, 2)).slots.length);
  const owner = await newSession("owner");
  await endSession(owner.token);
  assert.ok((await availability(date, 2)).slots.length);
  await newSession("owner");
  await database().query(
    "UPDATE booking.entry_sessions SET expires_at=now()-interval '1 minute'",
  );
  const guest = await newSession("guest");
  const booking = await createReservation(
    input(),
    undefined,
    guest.session.guest_number,
  );
  assert.equal(booking.status, "confirmed");
});
test("guest accounts have unique sequential numbers and hashed, revocable session tokens", async () => {
  await reset();
  const sessions = await Promise.all(
    Array.from({ length: 10 }, () => newSession("guest")),
  );
  const numbers = sessions
    .map((s) => Number(s.session.daily_number))
    .sort((a, b) => a - b);
  assert.equal(new Set(numbers).size, 10);
  assert.equal(numbers[9] - numbers[0], 9);
  const first = sessions[0];
  assert.notEqual(first.session.token_hash, first.token);
  assert.equal((await readSession(first.token))?.kind, "guest");
  assert.equal(await readSession("0".repeat(64)), null);
  const booking = await createReservation(
    input(),
    undefined,
    first.session.guest_number,
  );
  assert.equal(booking.guestNumber, first.session.daily_number);
  await endSession(first.token);
  assert.equal(await readSession(first.token), null);
});
test("owner passwords are verified using a salted hash", async () => {
  assert.equal(await verifyOwner("test-owner", "test-password"), true);
  assert.equal(await verifyOwner("test-owner", "wrong"), false);
  assert.equal(await verifyOwner("wrong", "test-password"), false);
});

test("owner sign-in and session restoration do not depend on the guest numbering function", { skip: sqlite }, async () => {
  await database().query("ALTER FUNCTION booking.guest_display_number(bigint) RENAME TO guest_display_number_unavailable");
  let token: string | undefined;
  try {
    assert.equal(await verifyOwner("test-owner", "test-password"), true);
    const created = await newSession("owner");
    token = created.token;
    assert.equal(sessionView(created.session).kind, "owner");
    assert.equal((await readSession(token))?.kind, "owner");
  } finally {
    await database().query("ALTER FUNCTION booking.guest_display_number_unavailable(bigint) RENAME TO guest_display_number");
    if (token) await endSession(token);
  }
});

test("owner can sign in, restore the session and sign out through the loopback API", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  delete process.env.APP_ORIGIN;
  try {
    const response = await signIn(new Request("http://localhost:3000/api/session", {
      method: "POST",
      headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "content-type": "application/json" },
      body: JSON.stringify({ kind: "owner", username: "test-owner", password: "test-password" }),
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).kind, "owner");
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const restored = await sessionStatus(new Request("http://localhost:3000/api/session", { headers: { cookie } }));
    assert.equal((await restored.json()).session.kind, "owner");
    const logout = await signOut(new Request("http://localhost:3000/api/session", {
      method: "DELETE", headers: { cookie, host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    }));
    assert.equal(logout.status, 200);
    const ended = await sessionStatus(new Request("http://localhost:3000/api/session", { headers: { cookie } }));
    assert.equal((await ended.json()).session, null);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("owner profile updates persist details, change the sign-in name and preserve only the active session", async () => {
  const current = await newSession("owner");
  const other = await newSession("owner");
  const updated = await updateOwnerProfileFromSession({
    sessionId: current.session.id,
    username: "profile-owner",
    name: "Owner Test",
    phone: "01012345678",
  });
  assert.equal(updated.username, "profile-owner");
  assert.equal(updated.owner_name, "Owner Test");
  assert.equal(updated.owner_phone, "01012345678");
  assert.equal((await readSession(current.token))?.kind, "owner");
  assert.equal(await readSession(other.token), null);
  assert.equal(await verifyOwner("profile-owner", "test-password"), true);
  const saved = (await database().query("SELECT owner_name,owner_phone FROM booking.owner_credentials WHERE id=1")).rows[0];
  assert.deepEqual(saved, { owner_name: "Owner Test", owner_phone: "01012345678" });
  await assert.rejects(
    () => changeOwnerPasswordFromSession(current.session.id, "wrong-password", "profile-new-password!"),
    /INVALID_LOGIN/,
  );
  await changeOwnerPasswordFromSession(current.session.id, "test-password", "profile-new-password!");
  assert.equal(await verifyOwner("profile-owner", "profile-new-password!"), true);
  assert.equal((await readSession(current.token))?.kind, "owner");
});

test("10:00 to midnight booking window supports meals across midnight and respects next-day closures", async () => {
  await reset();
  await database().query("DELETE FROM booking.opening_hours");
  await database().query(
    "INSERT INTO booking.opening_hours(weekday,opens,closes) VALUES(0,0,1440),(1,0,1440),(2,0,1440),(3,0,1440),(4,0,1440),(5,0,1440),(6,0,1440)",
  );
  assert.ok((await availability(date, 2)).slots.includes("23:30"));
  const b = await createReservation(input({ time: "23:30" }));
  const tomorrow = seoulDate(instant(date, 1440));
  assert.equal(
    (await availability(tomorrow, 2)).slots.includes("00:00"),
    false,
  );
  assert.ok((await availability(tomorrow, 2)).slots.includes("10:00"));
  await saveConfig(await getConfig(), actor);
  await updateReservation(
    (
      await database().query(
        "SELECT id FROM booking.reservations WHERE reference=$1",
        [b.reference],
      )
    ).rows[0].id,
    "cancelled",
    1,
    actor,
  );
  await database().query("INSERT INTO booking.closed_dates(date) VALUES($1)", [
    tomorrow,
  ]);
  assert.equal((await availability(date, 2)).slots.includes("23:30"), false);
});

test("private text records include Seoul date/time, guest number, phone, ordered items and updated status", async () => {
  await reset();
  const guest = await newSession("guest");
  const booking = await createReservation(
    input(),
    undefined,
    guest.session.guest_number,
  );
  let text = await readFile(recordsPath, "utf8");
  assert.ok(
    text.includes(
      `${date.replaceAll("-", " | ")} | 12:00 | ${guest.session.daily_number} | Guest ${guest.session.daily_number} | 01012345678 | Not recorded`,
    ),
  );
  const row = (
    await database().query(
      "SELECT id FROM booking.reservations WHERE reference=$1",
      [booking.reference],
    )
  ).rows[0];
  await updateOrderedItems(row.id, "Plov x2; tea x1\nSamsa | x3", 1, actor);
  text = await readFile(recordsPath, "utf8");
  assert.ok(text.includes("Plov x2; tea x1\\u000aSamsa \\u007c x3"));
  await assert.rejects(() =>
    updateOrderedItems(row.id, "Stale order", 1, actor),
  );
  await updateReservation(row.id, "cancelled", 2, actor);
  assert.ok((await readFile(recordsPath, "utf8")).includes(" | cancelled | "));
  await database().query(
    "UPDATE booking.reservations SET purge_at=now()-interval '1 minute'",
  );
  await purgeExpired();
  assert.equal(
    (await readFile(recordsPath, "utf8")).includes("01012345678"),
    false,
  );
});
test("text export failure never rolls back booking and can be retried from durable dirty state", async () => {
  await reset();
  try {
    process.env.RESERVATION_RECORDS_PATH = path.resolve(
      "public",
      "forbidden-records.txt",
    );
    const b = await createReservation(input());
    assert.equal(b.status, "confirmed");
    assert.equal(
      (
        await database().query(
          "SELECT dirty FROM booking.records_export WHERE id=1",
        )
      ).rows[0].dirty,
      true,
    );
  } finally {
    process.env.RESERVATION_RECORDS_PATH = recordsPath;
  }
  await syncRecords();
  assert.equal(
    (
      await database().query(
        "SELECT dirty FROM booking.records_export WHERE id=1",
      )
    ).rows[0].dirty,
    false,
  );
  assert.ok((await readFile(recordsPath, "utf8")).includes("01012345678"));
});

test("guest profile names default to Guest number, persist and update only their own text records", async () => {
  await reset();
  const first = await newSession("guest"),
    second = await newSession("guest");
  assert.equal(
    sessionView(first.session).displayName,
    `Guest ${first.session.daily_number}`,
  );
  await changeGuestName(first.token, "Customer One");
  const booking = await createReservation(
    input(),
    undefined,
    first.session.guest_number,
  );
  const another = await createReservation(
    input({ time: "13:30" }),
    undefined,
    second.session.guest_number,
  );
  assert.ok(
    (await readFile(recordsPath, "utf8")).includes(
      `${first.session.daily_number} | Customer One | 01012345678`,
    ),
  );
  const renamed = await changeGuestName(first.token, "Updated name");
  assert.equal(renamed.number, first.session.daily_number);
  assert.equal((await readSession(first.token))?.display_name, "Updated name");
  assert.ok(
    (await readFile(recordsPath, "utf8")).includes(
      `${first.session.daily_number} | Updated name | 01012345678`,
    ),
  );
  const rows = (
    await database().query(
      "SELECT reference,guest_name FROM booking.reservations ORDER BY starts_at",
    )
  ).rows;
  assert.equal(
    rows.find((r) => r.reference === booking.reference).guest_name,
    "Updated name",
  );
  assert.equal(
    rows.find((r) => r.reference === another.reference).guest_name,
    `Guest ${second.session.daily_number}`,
  );
  await endSession(first.token);
  await assert.rejects(() => changeGuestName(first.token, "Expired change"));
  assert.ok((await readFile(recordsPath, "utf8")).includes("Updated name"));
});
test("owner or unknown sessions cannot edit guest profiles", async () => {
  await reset();
  const owner = await newSession("owner");
  await assert.rejects(() => changeGuestName(owner.token, "Owner spoof"));
  await assert.rejects(() => changeGuestName("0".repeat(64), "Unknown"));
});

async function orderSetup() {
  await reset();
  await database().query("DELETE FROM booking.opening_hours");
  await database().query(
    "INSERT INTO booking.opening_hours(weekday,opens,closes) VALUES(0,0,1440),(1,0,1440),(2,0,1440),(3,0,1440),(4,0,1440),(5,0,1440),(6,0,1440)",
  );
  const session = await newSession("guest");
  const table = (await database().query("SELECT id FROM booking.dining_tables"))
    .rows[0].id;
  return { session, table };
}
function orderInput(table: string) {
  return {
    tableId: table,
    items: [
      { menuId: "plov", quantity: 2 },
      { menuId: "tea", quantity: 1 },
    ],
    idempotencyKey: randomUUID(),
    website: "",
  };
}
test("table orders use authenticated guest names, server menu prices and idempotent concurrent submission", async () => {
  const { session, table } = await orderSetup();
  await changeGuestName(session.token, "Order customer");
  const v = orderInput(table);
  const results = await Promise.all(
    Array.from({ length: 12 }, () => createOrder(v, session.session.id)),
  );
  assert.equal(new Set(results.map((r) => r.id)).size, 1);
  const r = results[0];
  assert.equal(r.guest_name, "Order customer");
  assert.equal(r.table_name, "TEST TABLE");
  assert.equal(r.estimated_total, 23000);
  assert.equal(r.status, "queued");
  assert.equal(
    (
      await database().query(
        "SELECT count(*)::int n FROM booking.dining_orders",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await database().query("SELECT count(*)::int n FROM booking.reservations"))
      .rows[0].n,
    0,
  );
  const txt = await readFile(ordersPath, "utf8");
  assert.ok(txt.includes("Order customer"));
  assert.ok(txt.includes("2 x Plov; 1 x Tea"));
  await assert.rejects(() =>
    createOrder(
      { ...v, items: [{ menuId: "tea", quantity: 1 }] },
      session.session.id,
    ),
  );
});
test("owner queue is FIFO under concurrent orders and concurrent staff status updates", async () => {
  const { session, table } = await orderSetup();
  await Promise.all(
    Array.from({ length: 8 }, () =>
      createOrder(orderInput(table), session.session.id),
    ),
  );
  const queue = await adminOrders(actor);
  assert.equal(queue.orders.length, 8);
  assert.equal(queue.nextOrderId, queue.orders[0].id);
  const numbers = queue.orders.map((o) => Number(o.queue_number));
  assert.deepEqual(
    numbers,
    [...numbers].sort((a, b) => a - b),
  );
  await assert.rejects(
    () => changeOrderStatus(queue.orders[1].id, "preparing", 1, actor),
    (e) => (e as { code: string }).code === "FIFO_REQUIRED",
  );
  const first = queue.orders[0];
  const updates = await Promise.allSettled([
    changeOrderStatus(first.id, "preparing", 1, actor),
    changeOrderStatus(first.id, "preparing", 1, actor),
  ]);
  assert.equal(updates.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await adminOrders(actor)).nextOrderId, queue.orders[1].id);
  await changeOrderStatus(first.id, "ready", 2, actor);
  await changeOrderStatus(first.id, "served", 3, actor);
  assert.equal(
    (await adminOrders(actor)).orders.some((o) => o.id === first.id),
    false,
  );
  assert.equal(
    (await adminOrders(actor, seoulDate())).orders.find(
      (o) => o.id === first.id,
    )?.status,
    "served",
  );
  await assert.rejects(() =>
    changeOrderStatus(first.id, "cancelled", 4, actor),
  );
});
test("ordering validates real tables, catalog, business closures and server-only prices", async () => {
  const { session, table } = await orderSetup();
  assert.ok(
    (await orderCatalog(session.session.id)).tables.some((t) => t.id === table),
  );
  await assert.rejects(() =>
    createOrder(orderInput(randomUUID()), session.session.id),
  );
  await assert.rejects(() =>
    createOrder(
      { ...orderInput(table), estimated_total: 1 } as any,
      session.session.id,
    ),
  );
  await assert.rejects(() =>
    createOrder(
      {
        ...orderInput(table),
        items: [{ menuId: "not-on-the-menu", quantity: 1 }],
      },
      session.session.id,
    ),
  );
  await database().query("UPDATE booking.dining_tables SET active=false");
  await assert.rejects(() =>
    createOrder(orderInput(table), session.session.id),
  );
  await database().query("UPDATE booking.dining_tables SET active=true");
  await database().query("INSERT INTO booking.closed_dates(date) VALUES($1)", [
    seoulDate(),
  ]);
  assert.equal((await orderCatalog(session.session.id)).open, false);
  await assert.rejects(() =>
    createOrder(orderInput(table), session.session.id),
  );
});
test("guest order history is isolated and expired or owner sessions cannot place guest orders", async () => {
  const { session, table } = await orderSetup();
  const second = await newSession("guest");
  const owner = await newSession("owner");
  const first = await createOrder(orderInput(table), session.session.id);
  const other = await createOrder(orderInput(table), second.session.id);
  assert.deepEqual(
    (await guestOrders(session.session.id)).map((o) => o.id),
    [first.id],
  );
  assert.deepEqual(
    (await guestOrders(second.session.id)).map((o) => o.id),
    [other.id],
  );
  await assert.rejects(() => createOrder(orderInput(table), owner.session.id));
  await endSession(session.token);
  await assert.rejects(() =>
    createOrder(orderInput(table), session.session.id),
  );
  await assert.rejects(() => guestOrders(session.session.id));
});
test("order records follow profile changes, cancellation and retention; missing prices remain unknown", async () => {
  const { session, table } = await orderSetup();
  const order = await createOrder(
    { ...orderInput(table), items: [{ menuId: "kefir", quantity: 1 }] },
    session.session.id,
  );
  assert.equal(order.estimated_total, null);
  await changeGuestName(session.token, "Renamed diner");
  assert.ok((await readFile(ordersPath, "utf8")).includes("Renamed diner"));
  await changeOrderStatus(order.id, "cancelled", 2, actor);
  assert.ok((await readFile(ordersPath, "utf8")).includes("cancelled"));
  await database().query(
    "UPDATE booking.dining_orders SET purge_at=now()-interval '1 minute'",
  );
  await purgeExpired();
  assert.equal(
    (await readFile(ordersPath, "utf8")).includes("Renamed diner"),
    false,
  );
});
test("order stays received when the text filesystem fails; retry repairs the private export", async () => {
  const { session, table } = await orderSetup();
  try {
    process.env.ORDERS_RECORDS_PATH = path.resolve(
      "public",
      "forbidden-orders.txt",
    );
    const r = await createOrder(orderInput(table), session.session.id);
    assert.equal(r.status, "queued");
    assert.equal(
      (
        await database().query(
          "SELECT count(*)::int n FROM booking.dining_orders",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    process.env.ORDERS_RECORDS_PATH = ordersPath;
  }
  await syncRecords();
  assert.ok((await readFile(ordersPath, "utf8")).includes("2 x Plov"));
});

test("daily guest numbers restart at 1, survive logout, and isolate dated history across days", async () => {
  const { table } = await orderSetup();
  // Move prior fixtures out of today to simulate a fresh day without changing
  // the server clock or resetting the permanent identity sequence.
  await database().query("UPDATE booking.guest_numbers SET guest_date='2000-01-01'");
  const yesterday = await newSession("guest");
  assert.equal(sessionView(yesterday.session).number, "1");
  const oldOrder = await createOrder(orderInput(table), yesterday.session.id);
  const oldBooking = await createReservation(input(), undefined, yesterday.session.guest_number);
  await changeOrderStatus(oldOrder.id, "preparing", 1, actor);
  await changeOrderStatus(oldOrder.id, "ready", 2, actor);
  await changeOrderStatus(oldOrder.id, "served", 3, actor);
  await database().query(`UPDATE booking.guest_numbers SET guest_date=(now() AT TIME ZONE 'Asia/Seoul')::date-1 WHERE guest_id=$1`, [yesterday.session.guest_number]);
  await database().query("UPDATE booking.dining_orders SET created_at=created_at-interval '1 day' WHERE id=$1", [oldOrder.id]);
  await database().query("UPDATE booking.entry_sessions SET expires_at=now()-interval '1 second' WHERE id=$1", [yesterday.session.id]);

  const today = await Promise.all(Array.from({ length: 10 }, () => newSession("guest")));
  assert.deepEqual(today.map(s => Number(s.session.daily_number)).sort((a,b) => a-b), [1,2,3,4,5,6,7,8,9,10]);
  const first = today.find(s => s.session.daily_number === "1")!;
  assert.notEqual(first.session.guest_number, yesterday.session.guest_number);
  assert.equal(await readSession(yesterday.token), null);
  assert.deepEqual(await guestOrders(first.session.id), []);
  await assert.rejects(() => createOrder(orderInput(table), yesterday.session.id), /UNAUTHORIZED/);
  const currentOrder = await createOrder(orderInput(table), first.session.id);
  const newBooking = await createReservation(input({time: "13:30"}), undefined, first.session.guest_number);
  assert.equal(newBooking.guestNumber, "1");
  await changeGuestName(first.token, "Today's customer");
  const priorName = (await database().query("SELECT guest_name FROM booking.reservations WHERE reference=$1", [oldBooking.reference])).rows[0].guest_name;
  assert.equal(priorName, "Guest 1");
  assert.deepEqual((await guestOrders(first.session.id)).map(o => o.id), [currentOrder.id]);
  const ownerHistory = await adminOrders(actor, seoulDate(new Date(Date.now()-86400000)));
  assert.equal(ownerHistory.orders.find(o => o.id===oldOrder.id)?.guest_number, "1");
  assert.equal(ownerHistory.orders.find(o => o.id===oldOrder.id)?.receipt.guest_number, 1);
  const text = await readFile(historyPath, "utf8");
  assert.ok(text.includes(oldOrder.reference) && text.includes(currentOrder.reference));
  assert.ok(text.includes(oldBooking.reference) && text.includes(newBooking.reference));
  assert.ok(text.includes("Guest 1") && text.includes("2 x Plov"));
  assert.ok(text.includes(seoulDate()) && text.includes(seoulDate(new Date(Date.now()-86400000))));
  const expiry = (await database().query(`SELECT expires_at<=(((now() AT TIME ZONE 'Asia/Seoul')::date+1)::timestamp AT TIME ZONE 'Asia/Seoul') AS capped FROM booking.entry_sessions WHERE id=$1`, [first.session.id])).rows[0];
  assert.equal(expiry.capped, true);
  await endSession(first.token);
  assert.equal((await newSession("guest")).session.daily_number, "11");

  process.env.BARAKA_EDGE = "true";
  try {
    await syncRecords(true);
    const snapshot = (await database().query("SELECT history_text FROM booking.records_export WHERE id=1")).rows[0].history_text;
    assert.ok(snapshot.includes(oldOrder.reference) && snapshot.includes(currentOrder.reference));
  } finally {
    delete process.env.BARAKA_EDGE;
  }
});
