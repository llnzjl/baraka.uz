import { writeFile, rename, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { transaction } from "./db";
import type { PoolClient } from "pg";

const cell = (value: unknown) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(
      /[\r\n\t|\u0000-\u001f\u007f]/g,
      (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );

// A private current-record export. PostgreSQL remains authoritative.
export async function recordsText(c: PoolClient) {
  const rows = (
    await c.query(`SELECT to_char(starts_at AT TIME ZONE 'Asia/Seoul','YYYY') AS year,
 to_char(starts_at AT TIME ZONE 'Asia/Seoul','MM') AS month,
 to_char(starts_at AT TIME ZONE 'Asia/Seoul','DD') AS day,
 to_char(starts_at AT TIME ZONE 'Asia/Seoul','HH24:MI') AS time,
 guest_number,guest_name,phone,ordered_items,reference,status,guests
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
    ]
      .map(cell)
      .join(" | "),
  );
  return [
    "BARAKA - Private reservation records",
    "Times: Asia/Seoul. Current records only; configured retention/deletion rules apply.",
    "Ordered items are entered by staff; Not recorded means no order has been entered.",
    "Year | Month | Day | Time (KST) | Guest number | Customer name | Phone number | Ordered items | Booking reference | Status | Party size",
    ...lines,
    "",
  ].join("\n");
}
export async function ordersText(c: PoolClient) {
  const rows = (
    await c.query(`SELECT queue_number,reference,table_name,guest_number,guest_name,items,status,estimated_total,
 to_char(created_at AT TIME ZONE 'Asia/Seoul','YYYY | MM | DD | HH24:MI:SS') AS received
 FROM booking.dining_orders WHERE purge_at>now() ORDER BY queue_number`)
  ).rows;
  return [
    "BARAKA - Private table order records",
    "Times: Asia/Seoul. Menu totals are estimates. Configured retention/deletion rules apply.",
    "Year | Month | Day | Received time | Queue number | Table | Guest number | Customer name | Ordered items | Status | Estimated KRW | Reference",
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
        ]
          .map(cell)
          .join(" | "),
    ),
    "",
  ].join("\n");
}
export async function receiptsText(c: PoolClient) {
  const rows = (
    await c.query(`SELECT receipt_number,reference,table_name,guest_number,guest_name,items,estimated_total,
 to_char(served_at AT TIME ZONE 'Asia/Seoul','YYYY | MM | DD | HH24:MI:SS') AS served
 FROM booking.order_receipts WHERE purge_at>now() ORDER BY receipt_number`)
  ).rows;
  return [
    "BARAKA - Private served meal receipt evidence",
    "Times: Asia/Seoul. Estimates are not proof of payment or tax invoices. Retention/deletion rules apply.",
    "Year | Month | Day | Served time | Receipt number | Order reference | Table | Guest number | Customer name | Items | Estimated KRW",
    ...rows.map((r) => r.served + " | " + [
      r.receipt_number,
      r.reference,
      r.table_name,
      r.guest_number,
      r.guest_name,
      r.items.map((i: { name: string; quantity: number; unitPrice: number | null }) => `${i.quantity} x ${i.name}${i.unitPrice === null ? " (price unconfirmed)" : ` @ KRW ${i.unitPrice}`}`).join("; "),
      r.estimated_total ?? "Confirm with staff",
    ].map(cell).join(" | ")),
    "",
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
      await c.query(
        `UPDATE booking.records_export
         SET reservation_text=$1,orders_text=$2,receipts_text=$3,dirty=false,exported_at=now()
         WHERE id=1`,
        [reservations, orders, receipts],
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
  for (const file of [target, ordersTarget, receiptsTarget]) {
    const normalized = process.platform === "win32" ? file.toLowerCase() : file;
    const publicDir =
      process.platform === "win32" ? publicPath.toLowerCase() : publicPath;
    if (normalized === publicDir || normalized.startsWith(publicDir + path.sep))
      throw new Error("Private records must be outside public.");
  }
  if (new Set([target, ordersTarget, receiptsTarget].map((p) => p.toLowerCase())).size !== 3)
    throw new Error("Reservation, order and receipt records need different files.");
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
  fn: (c: PoolClient) => Promise<T>,
) {
  const result = await transaction(fn);
  await syncRecordsSafely();
  return result;
}
