import { createHash, randomBytes } from "node:crypto";
import { ensureMenuSeeded, publicMenu } from "../menu/engine";
import { transaction } from "../booking/db";
import { recordedTransaction } from "../booking/records";
import { BookingError, instant } from "../booking/validation";
import { orderSchema, OrderInput, OrderItem } from "./validation";
import type { PoolClient } from "pg";

async function guest(c: PoolClient, id: string) {
  const s = (
    await c.query(
      "SELECT * FROM booking.entry_sessions WHERE id=$1 AND kind='guest' AND expires_at>now()",
      [id],
    )
  ).rows[0];
  if (!s) throw new BookingError("UNAUTHORIZED", 401);
  return s;
}
async function serviceOpen(c: PoolClient) {
  return Boolean(
    (
      await c.query(`SELECT 1 FROM booking.opening_hours WHERE weekday=EXTRACT(DOW FROM statement_timestamp() AT TIME ZONE 'Asia/Seoul')
 AND opens<=EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'Asia/Seoul')*60+EXTRACT(MINUTE FROM statement_timestamp() AT TIME ZONE 'Asia/Seoul')
 AND closes>EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'Asia/Seoul')*60+EXTRACT(MINUTE FROM statement_timestamp() AT TIME ZONE 'Asia/Seoul')
 AND NOT EXISTS(SELECT 1 FROM booking.closed_dates WHERE date=(statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date) LIMIT 1`)
    ).rowCount,
  );
}
export async function orderCatalog(sessionId: string) {
  const data = await transaction(async (c) => {
    await guest(c, sessionId);
    const tables = (
      await c.query(
        "SELECT id,name,seats FROM booking.dining_tables WHERE active ORDER BY name",
      )
    ).rows.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    return {
      tables,
      open: await serviceOpen(c),
    };
  });
  const menu = await publicMenu();
  return { ...data, menu: menu.map(i => ({ id:i.id,name:i.name,ko:i.ko,category:i.category,description:i.description,descriptionKo:i.descriptionKo,price:i.price })) };
}
export async function createOrder(raw: OrderInput, sessionId: string) {
  const v = orderSchema.parse(raw);
  const normalized = [...v.items].sort((a, b) =>
    a.menuId.localeCompare(b.menuId),
  );
  return recordedTransaction(async (c) => {
    // Serialize receipt/sequence assignment: queue number follows committed arrival order.
    const config = (
      await c.query(
        "SELECT retention_days FROM booking.restaurant_config WHERE id=1 FOR UPDATE",
      )
    ).rows[0];
    if (!config) throw new BookingError("UNAVAILABLE", 503);
    const s = await guest(c, sessionId);
    await ensureMenuSeeded(c);
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          guest: s.guest_number,
          table: v.tableId,
          items: normalized,
        }),
      )
      .digest("hex");
    const old = (
      await c.query(
        "SELECT * FROM booking.dining_orders WHERE idempotency_key=$1",
        [v.idempotencyKey],
      )
    ).rows[0];
    if (old) {
      if (old.guest_number !== s.guest_number || old.request_hash !== hash)
        throw new BookingError("IDEMPOTENCY_CONFLICT", 409);
      return old;
    }
    if (!(await serviceOpen(c))) throw new BookingError("ORDERING_CLOSED", 409);
    const table = (
      await c.query(
        "SELECT id,name FROM booking.dining_tables WHERE id=$1 AND active FOR SHARE",
        [v.tableId],
      )
    ).rows[0];
    if (!table) throw new BookingError("TABLE_UNAVAILABLE", 409);
    const currentMenu = (await c.query(
      "SELECT id,name,name_ko,price FROM booking.restaurant_menu WHERE id=ANY($1::text[]) AND active",
      [normalized.map(line => line.menuId)],
    )).rows;
    const items: OrderItem[] = normalized.map((line) => {
      const item = currentMenu.find((i) => i.id === line.menuId);
      if (!item) throw new BookingError("MENU_CHANGED", 409);
      return {
        menuId: item.id,
        name: item.name,
        nameKo: item.name_ko,
        quantity: line.quantity,
        unitPrice: item.price ?? null,
      };
    });
    const estimatedTotal = items.every((i) => i.unitPrice !== null)
      ? items.reduce((sum, i) => sum + i.quantity * i.unitPrice!, 0)
      : null;
    const r = (
      await c.query(
        `INSERT INTO booking.dining_orders(reference,idempotency_key,request_hash,guest_number,guest_name,table_id,table_name,items,estimated_total,purge_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp()+$10*interval '1 day') RETURNING *`,
        [
          `ORD-${randomBytes(6).toString("hex").toUpperCase()}`,
          v.idempotencyKey,
          hash,
          s.guest_number,
          s.display_name || `Guest ${s.guest_number}`,
          table.id,
          table.name,
          JSON.stringify(items),
          estimatedTotal,
          config.retention_days,
        ],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO booking.audit_log(actor,action,order_id) VALUES($1,$2,$3)",
      [s.id, "order received", r.id],
    );
    return r;
  });
}
const publicColumns =
  "id,queue_number,reference,guest_number,guest_name,table_id,table_name,items,estimated_total,status,version,created_at,updated_at";
const ownerColumns = publicColumns.split(",").map((column) => `o.${column}`).join(",");
export async function guestOrders(sessionId: string) {
  return transaction(async (c) => {
    const s = await guest(c, sessionId);
    return (
      await c.query(
        `SELECT ${publicColumns} FROM booking.dining_orders WHERE guest_number=$1 AND purge_at>now() ORDER BY queue_number DESC LIMIT 50`,
        [s.guest_number],
      )
    ).rows;
  });
}
export async function adminOrders(actor: string, date?: string) {
  return transaction(async (c) => {
    await c.query("INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)", [
      actor,
      "read orders",
    ]);
    const rows = (
      await c.query(
        `SELECT ${ownerColumns},
          CASE WHEN receipt.id IS NULL THEN NULL ELSE jsonb_build_object(
            'receipt_number',receipt.receipt_number,'served_at',receipt.served_at,
            'reference',receipt.reference,'table_name',receipt.table_name,
            'guest_number',receipt.guest_number,'guest_name',receipt.guest_name,
            'items',receipt.items,'estimated_total',receipt.estimated_total) END AS receipt
         FROM booking.dining_orders o LEFT JOIN booking.order_receipts receipt ON receipt.order_id=o.id
         WHERE o.purge_at>now() AND ${date ? "o.created_at>=$1 AND o.created_at<$2" : "o.status IN ('queued','preparing','ready')"} ORDER BY o.queue_number ASC LIMIT 501`,
        date ? [instant(date, 0), instant(date, 1440)] : [],
      )
    ).rows;
    const next =
      (
        await c.query(
          "SELECT id FROM booking.dining_orders WHERE status='queued' AND purge_at>now() ORDER BY queue_number LIMIT 1",
        )
      ).rows[0]?.id || null;
    return {
      orders: rows.slice(0, 500),
      hasMore: rows.length > 500,
      nextOrderId: next,
      timezone: "Asia/Seoul",
    };
  });
}
export async function changeOrderStatus(
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
        "SELECT * FROM booking.dining_orders WHERE id=$1 AND purge_at>now() FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!r) throw new BookingError("NOT_FOUND", 404);
    if (r.version !== version) throw new BookingError("STALE_VERSION", 409);
    const allowed: Record<string, string[]> = {
      queued: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["served", "cancelled"],
      served: [],
      cancelled: [],
    };
    if (!allowed[r.status].includes(status))
      throw new BookingError("INVALID_TRANSITION", 409);
    if (status === "preparing") {
      const first = (
        await c.query(
          "SELECT id FROM booking.dining_orders WHERE status='queued' AND purge_at>now() ORDER BY queue_number LIMIT 1",
        )
      ).rows[0];
      if (first?.id !== id) throw new BookingError("FIFO_REQUIRED", 409);
    }
    const updated = (
      await c.query(
        `UPDATE booking.dining_orders SET status=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING ${publicColumns}`,
        [id, status],
      )
    ).rows[0];
    if (status === "served") {
      await c.query(
        `INSERT INTO booking.order_receipts(order_id,reference,table_name,guest_number,guest_name,items,estimated_total,served_at,purge_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(order_id) DO NOTHING`,
        [r.id, r.reference, r.table_name, r.guest_number, r.guest_name, r.items, r.estimated_total, updated.updated_at, r.purge_at],
      );
    }
    await c.query(
      "INSERT INTO booking.audit_log(actor,action,order_id) VALUES($1,$2,$3)",
      [actor, `order ${status}`, id],
    );
    const receipt = status === "served"
      ? (await c.query("SELECT receipt_number,served_at,reference,table_name,guest_number,guest_name,items,estimated_total FROM booking.order_receipts WHERE order_id=$1", [id])).rows[0]
      : null;
    return { ...updated, receipt };
  });
}
