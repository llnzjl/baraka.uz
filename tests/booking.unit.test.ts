import { orderSchema, orderStatusSchema } from "../src/lib/orders/validation";
import { origin } from "../src/lib/booking/http";
import { guestProfileSchema } from "../src/lib/booking/validation";
import { ownerPasswordMeetsRules } from "../src/lib/booking/validation";
import { orderedItemsSchema } from "../src/lib/booking/validation";
import { test } from "node:test";
import assert from "node:assert/strict";
import { slotsFor, State } from "../src/lib/booking/engine";
import {
  bookingSchema,
  dateSchema,
  instant,
  seoulDate,
} from "../src/lib/booking/validation";
const now = new Date("2027-01-01T00:00:00Z");
test("local origin normalization accepts the exact loopback or LAN Host without weakening configured origins", () => {
  const previousMode = process.env.NODE_ENV;
  const previousOrigin = process.env.APP_ORIGIN;
  const env = process.env as Record<string, string | undefined>;
  const request = (value?: string, host = "127.0.0.1:3000") => new Request("http://localhost:3000/api/session", {
    headers: { host, ...(value ? { origin: value } : {}) },
  });
  try {
    env.NODE_ENV = "development";
    delete env.APP_ORIGIN;
    assert.doesNotThrow(() => origin(request("http://127.0.0.1:3000")));
    assert.doesNotThrow(() => origin(request("http://localhost:3000", "localhost:3000")));
    assert.doesNotThrow(() => origin(request("http://[::1]:3000", "[::1]:3000")));
    assert.doesNotThrow(() => origin(request("http://172.30.69.137:3001", "172.30.69.137:3001")));
    assert.doesNotThrow(() => origin(request("http://127.0.0.1:3001", "127.0.0.1:3001")));
    for (const candidate of [request(), request("null"), request("https://evil.example"),
      request("http://127.0.0.1:3001", "127.0.0.1:3000"), request("http://127.0.0.1:3000", "localhost:3000"),
      request("http://172.30.69.137:3001", "172.30.69.138:3001"),
      request("https://127.0.0.1:3000"), request("http://127.0.0.1:3000/path")]) {
      assert.throws(() => origin(candidate), /FORBIDDEN/);
    }
    env.APP_ORIGIN = "http://localhost:3000";
    assert.throws(() => origin(request("http://127.0.0.1:3000")), /FORBIDDEN/);
    assert.throws(() => origin(request("http://172.30.69.137:3001", "172.30.69.137:3001")), /FORBIDDEN/);
    env.NODE_ENV = "production";
    assert.doesNotThrow(() => origin(request("http://localhost:3000", "localhost:3000")));
    assert.throws(() => origin(request("http://127.0.0.1:3000")), /FORBIDDEN/);
    delete env.APP_ORIGIN;
    assert.throws(() => origin(request("http://127.0.0.1:3000")), /UNAVAILABLE/);
    assert.throws(() => origin(request("http://172.30.69.137:3001", "172.30.69.137:3001")), /UNAVAILABLE/);
  } finally {
    if (previousMode === undefined) delete env.NODE_ENV; else env.NODE_ENV = previousMode;
    if (previousOrigin === undefined) delete env.APP_ORIGIN; else env.APP_ORIGIN = previousOrigin;
  }
});
const state = (): State => ({
  config: {
    enabled: true,
    dining_minutes: 90,
    slot_minutes: 30,
    min_notice_minutes: 0,
    advance_days: 60,
    max_party: 8,
    max_concurrent_guests: 8,
    daily_booking_limit: 10,
    auto_confirm: true,
    retention_days: 7,
    privacy_version: "1",
  },
  tables: [
    { id: "one", name: "One", seats: 4, active: true },
    { id: "two", name: "Two", seats: 4, active: true },
  ],
  hours: [{ opens: 600, closes: 780 }],
  closed: false,
  allocations: [],
  visits: [],
});
test("owner password policy requires letters, digits, a symbol and rejects digit runs", () => {
  assert.equal(ownerPasswordMeetsRules("abcdef@529"), true);
  assert.equal(ownerPasswordMeetsRules("abcde@529"), false);
  assert.equal(ownerPasswordMeetsRules("abcdefghi@52"), false);
  assert.equal(ownerPasswordMeetsRules("abcdef@123"), false);
  assert.equal(ownerPasswordMeetsRules("abcdef@321"), false);
  assert.equal(ownerPasswordMeetsRules("abcdefg529"), false);
});
test("KST date boundary and UTC instants are independent of machine timezone", () => {
  assert.equal(seoulDate(new Date("2027-01-01T15:00:00Z")), "2027-01-02");
  assert.equal(
    instant("2027-01-02", 0).toISOString(),
    "2027-01-01T15:00:00.000Z",
  );
});
test("minute-level reservation times, dining duration and closed/disabled dates", () => {
  const s = state();
  const available = slotsFor(s, "2027-01-01", 2, now).map((x) => x.time);
  assert.equal(available.length, 91);
  assert.deepEqual(available.slice(0, 4), ["10:00", "10:01", "10:02", "10:03"]);
  assert.equal(available.at(-1), "11:30");
  assert.equal(slotsFor(s, "2026-12-31", 2, now).length, 0);
  assert.equal(
    slotsFor({ ...s, closed: true }, "2027-01-01", 2, now).length,
    0,
  );
  s.config.enabled = false;
  assert.equal(slotsFor(s, "2027-01-01", 2, now).length, 0);
});
test("full capacity, adjacency, party capacity and booking limits", () => {
  const s = state();
  s.allocations = s.tables.map((t) => ({
    table_id: t.id,
    starts_at: instant("2027-01-01", 600),
    ends_at: instant("2027-01-01", 690),
  }));
  assert.deepEqual(
    slotsFor(s, "2027-01-01", 2, now).map((x) => x.time),
    ["11:30"],
  );
  assert.equal(slotsFor(s, "2027-01-01", 5, now).length, 0);
  s.config.daily_booking_limit = 1;
  s.visits = [
    {
      guests: 4,
      starts_at: instant("2027-01-01", 600),
      ends_at: instant("2027-01-01", 690),
    },
  ];
  assert.equal(slotsFor(s, "2027-01-01", 2, now).length, 0);
});
test("concurrent covers and notice/advance limits", () => {
  const s = state();
  s.config.max_concurrent_guests = 4;
  s.visits = [
    {
      guests: 4,
      starts_at: instant("2027-01-01", 600),
      ends_at: instant("2027-01-01", 690),
    },
  ];
  assert.deepEqual(
    slotsFor(s, "2027-01-01", 2, now).map((x) => x.time),
    ["11:30"],
  );
  s.config.min_notice_minutes = 180;
  assert.equal(slotsFor(s, "2027-01-01", 2, now).length, 0);
  assert.equal(slotsFor(s, "2028-01-01", 2, now).length, 0);
});
test("invalid dates, spoofed fields, Korean phone and optional consent", () => {
  assert.equal(dateSchema.safeParse("2027-02-30").success, false);
  const v = {
    date: "2027-01-02",
    time: "18:00",
    guests: 2,
    name: "Test",
    phone: "+82 10-1234-5678",
    consent: true,
    adult: true,
    privacyVersion: "1",
    idempotencyKey: "4e6382e0-57eb-47ac-ae82-d1aaf30ce42f",
  };
  assert.equal(bookingSchema.parse(v).phone, "01012345678");
  for (const patch of [
    { guests: -1 },
    { phone: "123" },
    { consent: false },
    { adult: false },
    { time: "25:00" },
    { status: "confirmed" },
    { email: "test@example.com" },
    { website: "spam" },
  ])
    assert.equal(bookingSchema.safeParse({ ...v, ...patch }).success, false);
});

test("ordered items validation rejects oversized text, invalid versions and extra private fields", () => {
  assert.equal(
    orderedItemsSchema.safeParse({
      orderedItems: "Plov x2; tea x1",
      version: 1,
    }).success,
    true,
  );
  for (const body of [
    { orderedItems: "x".repeat(2001), version: 1 },
    { orderedItems: "Tea", version: 0 },
    { orderedItems: "Tea", version: 1, phone: "01000000000" },
  ])
    assert.equal(orderedItemsSchema.safeParse(body).success, false);
});

test("guest profile validation accepts custom names and rejects forged guest identifiers and control characters", () => {
  assert.equal(
    guestProfileSchema.parse({ displayName: "  Guest custom  " }).displayName,
    "Guest custom",
  );
  for (const displayName of [
    "",
    "  ",
    "x".repeat(81),
    "Line\nbreak",
    "Control\u0000",
  ])
    assert.equal(guestProfileSchema.safeParse({ displayName }).success, false);
  assert.equal(
    guestProfileSchema.safeParse({ displayName: "Someone", guestNumber: "2" })
      .success,
    false,
  );
});

test("order validation rejects price/name spoofing, empty carts, duplicate dishes and unreasonable quantities", () => {
  const base = {
    tableId: "4e6382e0-57eb-47ac-ae82-d1aaf30ce42f",
    idempotencyKey: "4e6382e0-57eb-47ac-ae82-d1aaf30ce42f",
    items: [{ menuId: "plov", quantity: 1 }],
  };
  assert.equal(orderSchema.safeParse(base).success, true);
  for (const v of [
    { ...base, guestName: "Spoof" },
    { ...base, estimatedTotal: 1 },
    { ...base, items: [] },
    { ...base, items: [{ menuId: "plov", quantity: 0 }] },
    { ...base, items: [{ menuId: "plov", quantity: 1.5 }] },
    {
      ...base,
      items: [
        { menuId: "plov", quantity: 1 },
        { menuId: "plov", quantity: 2 },
      ],
    },
    {
      ...base,
      items: [1, 2, 3, 4].map((i) => ({ menuId: String(i), quantity: 20 })),
    },
  ])
    assert.equal(orderSchema.safeParse(v).success, false);
  assert.equal(
    orderStatusSchema.safeParse({ status: "queued", version: 1 }).success,
    false,
  );
});
