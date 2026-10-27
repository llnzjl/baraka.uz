import { writeFile, rename, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { transaction } from "./db";
import type { DatabaseClient } from "./db";

const cell = (value: unknown) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(
      /[\r\n\t|\u0000-\u001f\u007f]/g,
      (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );

// A private current-record export. The configured database remains authoritative.
export async function recordsText(c: DatabaseClient) {
  const rows = (
    await c.query(`SELECT to_char(starts_at AT TIME ZONE 'Asia/Seoul','YYYY') AS year,
 to_char(starts_at AT TIME ZONE 'Asia/Seoul','MM') AS month,
 to_char(starts_at AT TIME ZONE 'Asia/Seoul','DD') AS day,
 to_char(starts_at AT TIME ZONE 'Asia/Seoul','HH24:MI') AS time,
 booking.guest_display_number(guest_number) AS guest_number,guest_name,phone,ordered_items,reference,status,guests,
 (SELECT guest_date::text FROM booking.guest_numbers WHERE guest_id=guest_number) AS guest_date
 FROM booking.reservations WHERE purge_at>now() ORDER BY starts_at,created_at,id`)
  ).rows;
  const lines = rows.map((r) =>
    [
      r.year,
      r.month,
      r.day,
      r.time,
      r.guest_number ?? "Manual",
      r.guest_name,
      r.phone,
      r.ordered_items || "Not recorded",
      r.reference,
      r.status,
      r.guests,
      r.guest_date,
    ]
      .map(cell)
      .join(" | "),
  );
  return [
    "BARAKA - Private reservation records",
    "Times: Asia/Seoul. Current records only; configured retention/deletion rules apply.",
    "Ordered items are entered by staff; Not recorded means no order has been entered.",
    "Year | Month | Day | Time (KST) | Guest number | Customer name | Phone number | Ordered items | Booking reference | Status | Party size | Guest numbering date",
    ...lines,
    "",
  ].join("\n");
}
export async function ordersText(c: DatabaseClient) {
  const rows = (
    await c.query(`SELECT queue_number,reference,table_name,booking.guest_display_number(guest_number) AS guest_number,guest_name,items,status,estimated_total,
 (SELECT guest_date::text FROM booking.guest_numbers WHERE guest_id=guest_number) AS guest_date,
 to_char(created_at AT TIME ZONE 'Asia/Seoul','YYYY | MM | DD | HH24:MI:SS') AS received
 FROM booking.dining_orders WHERE purge_at>now() ORDER BY queue_number`)
  ).rows;
  return [
    "BARAKA - Private table order records",
    "Times: Asia/Seoul. Menu totals are estimates. Configured retention/deletion rules apply.",
    "Year | Month | Day | Received time | Queue number | Table | Guest number | Customer name | Ordered items | Status | Estimated KRW | Reference | Guest numbering date",
    ...rows.map(
      (r) =>
        r.received +
        " | " +
        [
          r.queue_number,
          r.table_name,
          r.guest_number,
          r.guest_name,
          r.items
            .map(
              (i: { name: string; quantity: number }) =>
                `${i.quantity} x ${i.name}`,
            )
            .join("; "),
          r.status,
          r.estimated_total ?? "Confirm with staff",
          r.reference,
          r.guest_date,
        ]
          .map(cell)
          .join(" | "),
    ),
    "",
  ].join("\n");
}
export async function receiptsText(c: DatabaseClient) {
  const rows = (
    await c.query(`SELECT receipt_number,reference,table_name,booking.guest_display_number(guest_number) AS guest_number,guest_name,items,estimated_total,
 (SELECT guest_date::text FROM booking.guest_numbers WHERE guest_id=guest_number) AS guest_date,
 to_char(served_at AT TIME ZONE 'Asia/Seoul','YYYY | MM | DD | HH24:MI:SS') AS served
 FROM booking.order_receipts WHERE purge_at>now() ORDER BY receipt_number`)
  ).rows;
  return [
    "BARAKA - Private served meal receipt evidence",
    "Times: Asia/Seoul. Estimates are not proof of payment or tax invoices. Retention/deletion rules apply.",
    "Year | Month | Day | Served time | Receipt number | Order reference | Table | Guest number | Customer name | Items | Estimated KRW | Guest numbering date",
    ...rows.map((r) => r.served + " | " + [
      r.receipt_number,
      r.reference,
      r.table_name,
      r.guest_number,
      r.guest_name,
      r.items.map((i: { name: string; quantity: number; unitPrice: number | null }) => `${i.quantity} x ${i.name}${i.unitPrice === null ? " (price unconfirmed)" : ` @ KRW ${i.unitPrice}`}`).join("; "),
      r.estimated_total ?? "Confirm with staff",
      r.guest_date,
    ].map(cell).join(" | ")),
    "",
  ].join("\n");
}
export async function historyText(c: DatabaseClient) {
  return [
    "BARAKA - Private guest history",
    "Guest numbers restart at 1 each day in Asia/Seoul. Match each number with its guest numbering date.",
    "Daily resets preserve prior records. Configured retention/deletion rules still apply.",
    "",
    await ordersText(c),
    await recordsText(c),
    await receiptsText(c),
  ].join("\n");
}
export async function syncRecords(force = false) {
  if (process.env.BARAKA_EDGE === "true") {
    return transaction(async (c) => {
      const state = (
        await c.query("SELECT * FROM booking.records_export WHERE id=1 FOR UPDATE")
      ).rows[0];
      if (!state?.dirty && !force) return { synced: true };
      const reservations = await recordsText(c);
      const orders = await ordersText(c);
      const receipts = await receiptsText(c);
      const history = await historyText(c);
      await c.query(
        `UPDATE booking.records_export
         SET reservation_text=$1,orders_text=$2,receipts_text=$3,history_text=$4,dirty=false,exported_at=now()
         WHERE id=1`,
        [reservations, orders, receipts, history],
      );
      return { synced: true };
    });
  }
  const target = path.resolve(
    process.env.RESERVATION_RECORDS_PATH || "reservations.txt",
  );
  const publicPath = path.resolve("public");
  const ordersTarget = path.resolve(
    process.env.ORDERS_RECORDS_PATH || "orders.txt",
  );
  const receiptsTarget = path.resolve(
    process.env.RECEIPTS_RECORDS_PATH || "receipts.txt",
  );
  const historyTarget = path.resolve(process.env.HISTORY_RECORDS_PATH || "history.txt");
  for (const file of [target, ordersTarget, receiptsTarget, historyTarget]) {
    const normalized = process.platform === "win32" ? file.toLowerCase() : file;
    const publicDir =
      process.platform === "win32" ? publicPath.toLowerCase() : publicPath;
    if (normalized === publicDir || normalized.startsWith(publicDir + path.sep))
      throw new Error("Private records must be outside public.");
  }
  if (new Set([target, ordersTarget, receiptsTarget, historyTarget].map((p) => p.toLowerCase())).size !== 4)
    throw new Error("Reservation, order, receipt and history records need different files.");
  return transaction(async (c) => {
    // Row lock serializes writers across all application processes.
    const state = (
      await c.query(
        "SELECT * FROM booking.records_export WHERE id=1 FOR UPDATE",
      )
    ).rows[0];
    if (!state?.dirty && !force) return { synced: true };
    for (const [file, contents] of [
      [target, await recordsText(c)],
      [ordersTarget, await ordersText(c)],
      [receiptsTarget, await receiptsText(c)],
      [historyTarget, await historyText(c)],
    ]) {
      const temp = `${file}.${randomUUID()}.tmp`;
      try {
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await writeFile(temp, contents, {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        });
        await rename(temp, file);
      } finally {
        await unlink(temp).catch(() => {});
      }
    }
    await c.query(
      "UPDATE booking.records_export SET dirty=false,exported_at=now() WHERE id=1",
    );
    return { synced: true };
  });
}
export async function syncRecordsSafely() {
  try {
    return await syncRecords();
  } catch {
    // A failed file write never invalidates an already committed booking/order.
    console.error(
      "Reservation text export pending; retry with the records job.",
    );
    return { synced: false };
  }
}
export async function recordedTransaction<T>(
  fn: (c: DatabaseClient) => Promise<T>,
) {
  const result = await transaction(fn);
  await syncRecordsSafely();
  return result;
}
