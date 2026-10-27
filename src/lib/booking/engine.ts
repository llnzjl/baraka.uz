import { recordedTransaction } from "./records";
import type { DatabaseClient } from "./db";
import { createHash, randomBytes } from "crypto";
import { database, transaction } from "./db";
import {
  BookingError,
  BookingInput,
  clock,
  instant,
  seoulDate,
  configSchema,
} from "./validation";
import { z } from "zod";

export type Config = {
  enabled: boolean;
  dining_minutes: number;
  slot_minutes: number;
  min_notice_minutes: number;
  advance_days: number;
  max_party: number;
  max_concurrent_guests: number;
  daily_booking_limit: number;
  auto_confirm: boolean;
  retention_days: number;
  privacy_version: string;
};
type Table = { id: string; name: string; seats: number; active: boolean };
type Allocation = { table_id: string; starts_at: Date; ends_at: Date };
type Visit = { guests: number; starts_at: Date; ends_at: Date };
export type State = {
  config: Config;
  tables: Table[];
  hours: { opens: number; closes: number }[];
  closed: boolean;
  allocations: Allocation[];
  visits: Visit[];
};
const overlaps = (a: Date, b: Date, c: Date, d: Date) => a < d && c < b;
export function slotsFor(
  state: State,
  date: string,
  guests: number,
  now = new Date(),
) {
  const { config: c } = state;
  const today = seoulDate(now),
    latest = seoulDate(new Date(now.getTime() + c.advance_days * 86400000));
  if (
    !c.enabled ||
    state.closed ||
    guests > c.max_party ||
    date < today ||
    date > latest ||
    state.visits.filter((v) => seoulDate(new Date(v.starts_at)) === date)
      .length >= c.daily_booking_limit
  )
    return [];
  const result: { time: string; tableId: string }[] = [];
  for (const h of state.hours) {
    for (
      // Reservations start on any minute between 10:00 and midnight.
      // Availability remains database-backed for each candidate minute.
      let m = Math.max(h.opens, 10 * 60);
      m < Math.min(h.closes, 1440) && m + c.dining_minutes <= h.closes;
      m += 1
    ) {
      const start = instant(date, m),
        end = instant(date, m + c.dining_minutes);
      if (start.getTime() <= now.getTime() + c.min_notice_minutes * 60000)
        continue;
      const overlapping = state.visits.filter((v) =>
        overlaps(start, end, new Date(v.starts_at), new Date(v.ends_at)),
      );
      // Evaluate every change point, not the sum of non-concurrent bookings across a long visit.
      const points = [
        start,
        ...overlapping
          .map((v) => new Date(v.starts_at))
          .filter((d) => d > start),
      ];
      if (
        points.some(
          (p) =>
            guests +
              overlapping
                .filter(
                  (v) => new Date(v.starts_at) <= p && p < new Date(v.ends_at),
                )
                .reduce((sum, v) => sum + v.guests, 0) >
            c.max_concurrent_guests,
        )
      )
        continue;
      const table = state.tables
        .filter((t) => t.active && t.seats >= guests)
        .sort((a, b) => a.seats - b.seats || a.id.localeCompare(b.id))
        .find(
          (t) =>
            !state.allocations.some(
              (a) =>
                a.table_id === t.id &&
                overlaps(
                  start,
                  end,
                  new Date(a.starts_at),
                  new Date(a.ends_at),
                ),
            ),
        );
      if (table) result.push({ time: clock(m), tableId: table.id });
    }
  }
  return result;
}
async function load(
  c: DatabaseClient,
  date: string,
  write = false,
): Promise<State> {
  const config = (
    await c.query<Config>(
      `SELECT * FROM booking.restaurant_config WHERE id=1 FOR ${write ? "UPDATE" : "SHARE"}`,
    )
  ).rows[0];
  if (!config) throw new BookingError("UNAVAILABLE", 503);
  const from = instant(date, 0),
    to = instant(date, 1440 + config.dining_minutes),
    weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const tables = (await c.query<Table>("SELECT * FROM booking.dining_tables"))
    .rows;
  const hours = (
    await c.query(
      "SELECT opens,closes FROM booking.opening_hours WHERE weekday=$1 ORDER BY opens",
      [weekday],
    )
  ).rows;
  const closed =
    (await c.query("SELECT 1 FROM booking.closed_dates WHERE date=$1", [date]))
      .rowCount !== 0;
  // Consecutive services across midnight form one continuous opening interval.
  const nextDate = seoulDate(instant(date, 1440));
  const next = (
    await c.query(
      "SELECT closes FROM booking.opening_hours WHERE weekday=$1 AND opens=0 AND NOT EXISTS (SELECT 1 FROM booking.closed_dates WHERE date=$2)",
      [(weekday + 1) % 7, nextDate],
    )
  ).rows[0];
  if (next)
    for (const h of hours) if (h.closes === 1440) h.closes += next.closes;
  const allocations = (
    await c.query<Allocation>(
      "SELECT table_id,starts_at,ends_at FROM booking.table_allocations WHERE active AND starts_at<$2 AND ends_at>$1",
      [from, to],
    )
  ).rows;
  const visits = (
    await c.query<Visit>(
      "SELECT guests,starts_at,ends_at FROM booking.reservations WHERE status IN ('pending','confirmed','completed','no_show') AND ends_at > $1 AND starts_at<$2",
      [from, to],
    )
  ).rows;
  return { config, tables, hours, closed, allocations, visits };
}
export function publicPolicy() {
  return {
    url: process.env.PRIVACY_POLICY_URL || "",
    contact: process.env.PRIVACY_CONTACT || "",
    controller: process.env.PRIVACY_CONTROLLER || "",
  };
}
export function productionReady() {
  const present = [
    "PRIVACY_CONTROLLER",
    "PRIVACY_CONTACT",
    "PRIVACY_POLICY_URL",
    "TURNSTILE_SECRET_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "APP_ORIGIN",
    "RATE_LIMIT_SECRET",
    "TRUSTED_IP_HEADER",
    "CRON_SECRET",
    "OWNER_USERNAME",
    "OWNER_PASSWORD_HASH",
  ].every((k) => Boolean(process.env[k]));
  if (
    !present ||
    (process.env.CRON_SECRET?.length || 0) < 32 ||
    (process.env.RATE_LIMIT_SECRET?.length || 0) < 32
  )
    return false;
  try {
    const origin = new URL(process.env.APP_ORIGIN!);
    return (
      origin.protocol === "https:" &&
      origin.origin === process.env.APP_ORIGIN &&
      new URL(process.env.PRIVACY_POLICY_URL!).protocol === "https:"
    );
  } catch {
    return false;
  }
}
export async function availability(date: string, guests: number) {
  return transaction(async (c) => {
    const state = await load(c, date);
    const ready =
      state.config.enabled &&
      (process.env.NODE_ENV !== "production" || productionReady());
    return {
      slots: ready ? slotsFor(state, date, guests).map((s) => s.time) : [],
      enabled: ready,
      timezone: "Asia/Seoul",
      retentionDays: state.config.retention_days,
      privacyVersion: state.config.privacy_version,
      maxParty: state.config.max_party,
      advanceDays: state.config.advance_days,
      policy: publicPolicy(),
    };
  });
}
export async function enqueue(c: DatabaseClient, r: Record<string, any>) {
  const translated: Record<string, Record<string, string>> = {
    ko: {
      confirmed: "예약 확정",
      pending: "예약 승인 대기",
      cancelled: "예약 취소",
    },
    en: {
      confirmed: "Reservation confirmed",
      pending: "Reservation awaiting approval",
      cancelled: "Reservation cancelled",
    },
    uz: {
      confirmed: "Bandlov tasdiqlandi",
      pending: "Bandlov tasdiqlanishi kutilmoqda",
      cancelled: "Bandlov bekor qilindi",
    },
    ru: {
      confirmed: "Бронирование подтверждено",
      pending: "Бронирование ожидает подтверждения",
      cancelled: "Бронирование отменено",
    },
  };
  if (!["pending", "confirmed", "cancelled"].includes(r.status)) return;
  const title = translated[r.locale][r.status];
  const when = new Date(new Date(r.starts_at).getTime() + 9 * 3600000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
  const body = `BARAKA\n${title}\n${r.reference}\n${when} (Asia/Seoul)\n${r.guests} ${{ ko: "명", en: "guests", uz: "kishi", ru: "гостей" }[r.locale as "ko" | "en" | "uz" | "ru"]}\n${process.env.PRIVACY_CONTACT || ""}`;
  const ownerEmail = (await c.query("SELECT owner_email FROM booking.owner_credentials WHERE id=1")).rows[0]?.owner_email || process.env.OWNER_EMAIL;
  const recipients = process.env.RESEND_API_KEY && process.env.RESEND_FROM ? [
    { email: r.email, kind: "customer" },
    { email: ownerEmail, kind: "owner" },
  ].filter((x) => x.email) : [];
  for (const x of recipients)
    await c.query(
      "INSERT INTO booking.notifications(reservation_id,event_key,recipient,subject,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_key) DO NOTHING",
      [
        r.id,
        `${r.id}/${r.version}/${x.kind}`,
        x.email,
        `BARAKA · ${title} · ${r.reference}`,
        x.kind === "owner"
          ? `${body}\n${process.env.APP_ORIGIN}/admin/reservations`
          : body,
      ],
    );
}
function receipt(r: Record<string, any>) {
  return {
    reference: r.reference,
    guestNumber: r.daily_number,
    status: r.status,
    date: seoulDate(new Date(r.starts_at)),
    time: new Date(new Date(r.starts_at).getTime() + 9 * 3600000)
      .toISOString()
      .slice(11, 16),
    guests: r.guests,
  };
}
export async function createReservation(
  input: BookingInput,
  actor?: string,
  guestNumber?: string,
) {
  const { botToken, website, idempotencyKey, ...meaningful } = input;
  const hash = createHash("sha256")
    .update(JSON.stringify({ ...meaningful, guestNumber: guestNumber || null }))
    .digest("hex");
  return recordedTransaction(async (c) => {
    const state = await load(c, input.date, true);
    const old = (
      await c.query(
        "SELECT *,booking.guest_display_number(guest_number) AS daily_number FROM booking.reservations WHERE idempotency_key=$1",
        [idempotencyKey],
      )
    ).rows[0];
    if (old) {
      if (old.request_hash !== hash)
        throw new BookingError("IDEMPOTENCY_CONFLICT", 409);
      return receipt(old);
    }
    if (
      !state.config.enabled ||
      (process.env.NODE_ENV === "production" && !productionReady())
    )
      throw new BookingError("UNAVAILABLE", 503);
    if (input.privacyVersion !== state.config.privacy_version)
      throw new BookingError("POLICY_CHANGED", 409);
    const slot = slotsFor(state, input.date, input.guests).find(
      (s) => s.time === input.time,
    );
    if (!slot) throw new BookingError("SLOT_UNAVAILABLE", 409);
    const start = new Date(`${input.date}T${input.time}:00+09:00`),
      end = new Date(start.getTime() + state.config.dining_minutes * 60000);
    const purge = new Date(
      end.getTime() + state.config.retention_days * 86400000,
    );
    const profile = guestNumber
      ? (
          await c.query(
            "SELECT display_name,booking.guest_display_number(guest_number) AS daily_number FROM booking.entry_sessions WHERE guest_number=$1 AND kind='guest' AND expires_at>now()",
            [guestNumber],
          )
        ).rows[0]
      : null;
    if (guestNumber && !profile) throw new BookingError("UNAUTHORIZED", 401);
    const guestName = guestNumber
      ? profile.display_name || `Guest ${profile.daily_number}`
      : input.name;
    const r = (
      await c.query(
        `INSERT INTO booking.reservations(reference,idempotency_key,request_hash,name,phone,email,notes,guests,starts_at,ends_at,status,locale,privacy_version,source,created_by,purge_at,guest_number,guest_name)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *,booking.guest_display_number(guest_number) AS daily_number`,
        [
          `BRK-${randomBytes(8).toString("hex").toUpperCase()}`,
          idempotencyKey,
          hash,
          input.name,
          input.phone,
          input.email || null,
          input.notes,
          input.guests,
          start,
          end,
          state.config.auto_confirm ? "confirmed" : "pending",
          input.locale,
          input.privacyVersion,
          actor ? "admin" : "web",
          actor || null,
          purge,
          guestNumber || null,
          guestName,
        ],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO booking.table_allocations(reservation_id,table_id,starts_at,ends_at) VALUES($1,$2,$3,$4)",
      [r.id, slot.tableId, start, end],
    );
    if (input.optionalConsent)
      await c.query(
        "UPDATE booking.reservations SET optional_consent_at=now() WHERE id=$1",
        [r.id],
      );
    await enqueue(c, r);
    if (actor)
      await c.query(
        "INSERT INTO booking.audit_log(actor,action,reservation_id) VALUES($1,$2,$3)",
        [actor, "create", r.id],
      );
    return receipt(r);
  });
}
export async function updateReservation(
  id: string,
  status: string,
  version: number,
  actor: string,
) {
  return recordedTransaction(async (c) => {
    await c.query(
      "SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE",
    );
    const r = (
      await c.query(
        "SELECT * FROM booking.reservations WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!r) throw new BookingError("NOT_FOUND", 404);
    if (r.version !== version) throw new BookingError("STALE_VERSION", 409);
    const allowed: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["cancelled", "completed", "no_show"],
      cancelled: [],
      completed: [],
      no_show: [],
    };
    if (!allowed[r.status].includes(status))
      throw new BookingError("INVALID_TRANSITION", 409);
    if (
      ["completed", "no_show"].includes(status) &&
      new Date(r.ends_at) > new Date()
    )
      throw new BookingError("TOO_EARLY", 409);
    if (status === "confirmed" && new Date(r.starts_at) <= new Date())
      throw new BookingError("TOO_LATE", 409);
    const updated = (
      await c.query(
        "UPDATE booking.reservations SET status=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
        [id, status],
      )
    ).rows[0];
    if (["cancelled", "completed", "no_show"].includes(status))
      await c.query(
        "UPDATE booking.table_allocations SET active=false WHERE reservation_id=$1",
        [id],
      );
    await enqueue(c, updated);
    await c.query(
      "INSERT INTO booking.audit_log(actor,action,reservation_id) VALUES($1,$2,$3)",
      [actor, status, id],
    );
    return { id, status, version: updated.version };
  });
}
export async function listReservations(date: string, actor: string) {
  return transaction(async (c) => {
    await c.query("INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)", [
      actor,
      "read reservations",
    ]);
    return (
      await c.query(
        `SELECT r.id,r.reference,booking.guest_display_number(r.guest_number) AS guest_number,r.guest_name,r.name,r.phone,r.email,r.notes,r.ordered_items,r.guests,r.starts_at,r.ends_at,r.status,r.version,r.locale,
    COALESCE((SELECT json_agg(t.name) FROM booking.table_allocations a JOIN booking.dining_tables t ON a.table_id=t.id WHERE a.reservation_id=r.id),'[]') AS tables
    FROM booking.reservations r WHERE r.starts_at >= $1 AND r.starts_at < $2 ORDER BY r.starts_at`,
        [instant(date, 0), instant(date, 1440)],
      )
    ).rows;
  });
}
export async function getConfig() {
  return transaction(async (c) => {
    const config = (
      await c.query(
        "SELECT * FROM booking.restaurant_config WHERE id=1 FOR SHARE",
      )
    ).rows[0];
    return {
      ...config,
      tables: (
        await c.query("SELECT * FROM booking.dining_tables ORDER BY name")
      ).rows,
      hours: (
        await c.query(
          "SELECT weekday,opens,closes FROM booking.opening_hours ORDER BY weekday,opens",
        )
      ).rows,
      closures: (
        await c.query(
          "SELECT to_char(date,'YYYY-MM-DD') AS date,reason FROM booking.closed_dates ORDER BY date",
        )
      ).rows,
    };
  });
}
export async function saveConfig(
  v: z.infer<typeof configSchema>,
  actor: string,
) {
  if (
    new Set(v.tables.map((t) => t.name)).size !== v.tables.length ||
    new Set(v.tables.filter((t) => t.id).map((t) => t.id)).size !==
      v.tables.filter((t) => t.id).length
  )
    throw new BookingError("INVALID_INPUT");
  if (
    v.enabled &&
    (!v.hours.length ||
      !v.tables.some((t) => t.active) ||
      (process.env.NODE_ENV === "production" && !productionReady()))
  )
    throw new BookingError("CONFIG_INCOMPLETE");
  return transaction(async (c) => {
    await c.query(
      "SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE",
    );
    const future = (
      await c.query(
        "SELECT r.*,a.table_id FROM booking.reservations r JOIN booking.table_allocations a ON a.reservation_id=r.id AND a.active WHERE r.status IN ('pending','confirmed') AND r.ends_at>now()",
      )
    ).rows;
    // Permit safe changes, but never silently displace an existing guest.
    for (const r of future) {
      const date = seoulDate(new Date(r.starts_at)),
        weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const start =
          (new Date(r.starts_at).getTime() - instant(date, 0).getTime()) /
          60000,
        end =
          (new Date(r.ends_at).getTime() - instant(date, 0).getTime()) / 60000;
      const table = v.tables.find((t) => t.id === r.table_id);
      if (
        !table?.active ||
        table.seats < r.guests ||
        v.closures.some((d) => d.date === date) ||
        !v.hours.some(
          (h) =>
            h.weekday === weekday &&
            h.opens <= start &&
            (h.closes >= end ||
              (h.closes === 1440 &&
                end > 1440 &&
                !v.closures.some(
                  (d) => d.date === seoulDate(instant(date, 1440)),
                ) &&
                v.hours.some(
                  (n) =>
                    n.weekday === (weekday + 1) % 7 &&
                    n.opens === 0 &&
                    n.closes >= end - 1440,
                ))),
        )
      )
        throw new BookingError("ACTIVE_BOOKINGS_CONFIG_LOCKED", 409);
      const concurrent = future
        .filter(
          (x) =>
            new Date(x.starts_at) <= new Date(r.starts_at) &&
            new Date(x.ends_at) > new Date(r.starts_at),
        )
        .reduce((n, x) => n + x.guests, 0);
      if (concurrent > v.max_concurrent_guests)
        throw new BookingError("ACTIVE_BOOKINGS_CONFIG_LOCKED", 409);
    }
    await c.query(
      `UPDATE booking.restaurant_config SET enabled=$1,dining_minutes=$2,slot_minutes=$3,min_notice_minutes=$4,advance_days=$5,max_party=$6,max_concurrent_guests=$7,daily_booking_limit=$8,auto_confirm=$9,retention_days=$10,privacy_version=$11,updated_at=now() WHERE id=1`,
      [
        v.enabled,
        v.dining_minutes,
        v.slot_minutes,
        v.min_notice_minutes,
        v.advance_days,
        v.max_party,
        v.max_concurrent_guests,
        v.daily_booking_limit,
        v.auto_confirm,
        v.retention_days,
        v.privacy_version,
      ],
    );
    await c.query("UPDATE booking.dining_tables SET active=false");
    for (const t of v.tables) {
      if (t.id) {
        const q = await c.query(
          "UPDATE booking.dining_tables SET name=$2,seats=$3,active=$4 WHERE id=$1",
          [t.id, t.name, t.seats, t.active],
        );
        if (!q.rowCount) throw new BookingError("INVALID_INPUT");
      } else
        await c.query(
          "INSERT INTO booking.dining_tables(name,seats,active) VALUES($1,$2,$3)",
          [t.name, t.seats, t.active],
        );
    }
    await c.query("DELETE FROM booking.opening_hours");
    for (const h of v.hours)
      await c.query(
        "INSERT INTO booking.opening_hours(weekday,opens,closes) VALUES($1,$2,$3)",
        [h.weekday, h.opens, h.closes],
      );
    await c.query("DELETE FROM booking.closed_dates");
    for (const d of v.closures)
      await c.query(
        "INSERT INTO booking.closed_dates(date,reason) VALUES($1,$2)",
        [d.date, d.reason],
      );
    await c.query("INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)", [
      actor,
      "configuration updated",
    ]);
    return { saved: true };
  });
}
export async function purgeExpired() {
  await database().query(
    "DELETE FROM booking.entry_sessions WHERE expires_at<=now()",
  );
  return recordedTransaction(async (c) => {
    await c.query(
      "SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE",
    );
    const deleted = await c.query(
      "DELETE FROM booking.reservations WHERE purge_at<now()",
    );
    await c.query("DELETE FROM booking.dining_orders WHERE purge_at<now()");
    await c.query("DELETE FROM booking.rate_limits WHERE expires_at<now()");
    await c.query(
      "DELETE FROM booking.audit_log WHERE created_at<now()-interval '90 days'",
    );
    return { deleted: deleted.rowCount };
  });
}

export async function updateOrderedItems(
  id: string,
  orderedItems: string,
  version: number,
  actor: string,
) {
  return recordedTransaction(async (c) => {
    await c.query(
      "SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE",
    );
    const r = (
      await c.query(
        "SELECT version FROM booking.reservations WHERE id=$1 AND purge_at>now() FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!r) throw new BookingError("NOT_FOUND", 404);
    if (r.version !== version) throw new BookingError("STALE_VERSION", 409);
    const updated = (
      await c.query(
        "UPDATE booking.reservations SET ordered_items=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING version",
        [id, orderedItems],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO booking.audit_log(actor,action,reservation_id) VALUES($1,$2,$3)",
      [actor, "ordered items updated", id],
    );
    return { id, version: updated.version };
  });
}
