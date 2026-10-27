"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import OwnerTabs from "./OwnerTabs";
import { seoulDate } from "@/lib/booking/validation";
import type { DiningOrder } from "@/lib/orders/validation";
import { apiFetch, downloadApiFile } from "@/lib/client/api";
const labels: Record<string, string> = {
  queued: "Received",
  preparing: "Preparing",
  ready: "Ready to serve",
  served: "Served",
  cancelled: "Cancelled",
};
export default function OrderAdmin() {
  const [orders, setOrders] = useState<DiningOrder[]>([]),
    [next, setNext] = useState<string | null>(null),
    [history, setHistory] = useState(false),
    [date, setDate] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [synced, setSynced] = useState(true),
    [more, setMore] = useState(false),
    [loaded, setLoaded] = useState(false),
    [updated, setUpdated] = useState(""),
    [printReceipt, setPrintReceipt] = useState<DiningOrder["receipt"]>(null);
  const sequence = useRef(0);
  useEffect(() => setDate(seoulDate()), []);
  const refresh = useCallback(async () => {
    if (history && !date) return;
    const id = ++sequence.current;
    try {
      const r = await apiFetch(
        "/api/admin/orders" + (history ? `?date=${date}` : ""),
        { cache: "no-store" },
      );
      if (!r.ok) {
        if ([401, 403].includes(r.status)) {
          setOrders([]);
          setNext(null);
        }
        throw new Error(
          r.status === 401
            ? "Sign in again to view orders."
            : "Order queue could not refresh. Check the connection.",
        );
      }
      const d = await r.json();
      if (id !== sequence.current) return;
      setOrders(d.orders);
      setNext(d.nextOrderId);
      setSynced(d.recordsSynced);
      setMore(d.hasMore);
      setLoaded(true);
      setUpdated(
        new Date().toLocaleTimeString("en-GB", {
          timeZone: "Asia/Seoul",
          hour12: false,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [history, date]);
  useEffect(() => {
    setOrders([]);
    setLoaded(false);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function change(order: DiningOrder, status: string) {
    if (
      status === "cancelled" &&
      !window.confirm(
        `Cancel order #${order.queue_number} from ${order.table_name}?`,
      )
    )
      return;
    setBusy(order.id);
    setError("");
    try {
      const r = await apiFetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, version: order.version }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(
          d.error === "FIFO_REQUIRED"
            ? "Start the oldest received order first."
            : d.error === "STALE_VERSION"
              ? "This order was updated elsewhere. Review the refreshed queue."
              : "The order could not be updated.",
        );
      if (status === "served" && d.order?.receipt)
        setPrintReceipt(d.order.receipt);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="admin-shell">
      <Link className="text-link" href="/">
        BARAKA · Return to website
      </Link>
      <OwnerTabs />
      <p className="eyebrow">LIVE KITCHEN QUEUE</p>
      <h1>Table orders</h1>
      <p>
        Oldest orders appear first. Start the first received order, then mark it
        ready and served.
      </p>
      <div className="admin-toolbar">
        <button aria-pressed={!history} onClick={() => setHistory(false)}>
          Active queue
        </button>
        <button aria-pressed={history} onClick={() => setHistory(true)}>
          Daily history
        </button>
        {history && (
          <label>
            Date (KST)
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}
        <button onClick={() => void refresh()}>Refresh</button>
        <button
          className="text-link"
          onClick={() => void downloadApiFile("/api/admin/orders/records", "orders.txt").catch(() => setError("Download unavailable"))}
        >
          Download orders (.txt)
        </button>
        <button className="text-link" onClick={() => void downloadApiFile("/api/admin/orders/receipts", "receipts.txt").catch(() => setError("Download unavailable"))}>
          Download meal receipts (.txt)
        </button>
        <button className="text-link" onClick={() => void downloadApiFile("/api/admin/history", "history.txt").catch(() => setError("Download unavailable"))}>
          Download guest history (.txt)
        </button>
        <small>
          {updated
            ? `Updated ${updated} KST · refreshes every 3 seconds`
            : "Connecting…"}
        </small>
      </div>
      <p className="admin-error" role="alert">
        {error}
      </p>
      {!synced && (
        <p role="status">
          Orders are saved. The text file needs a retry; check server file
          permissions.
        </p>
      )}
      {more && (
        <p>
          Showing the oldest 500 orders. Clear completed orders or choose a date
          to view more.
        </p>
      )}
      <div className="order-queue-summary">
        {["queued", "preparing", "ready"].map((status) => (
          <div key={status}>
            <strong>{orders.filter((o) => o.status === status).length}</strong>
            <span>{labels[status]}</span>
          </div>
        ))}
      </div>
      <div className="owner-order-grid">
        {orders.map((o) => (
          <article
            key={o.id}
            className={`owner-order-card ${o.id === next ? "next-order" : ""}`}
          >
            <header>
              <div>
                <p className="eyebrow">
                  {o.id === next ? "NEXT IN QUEUE" : `ORDER ${o.reference}`}
                </p>
                <h2>
                  #{o.queue_number} <span>{o.table_name}</span>
                </h2>
              </div>
              <span className={`order-status status-${o.status}`}>
                {labels[o.status]}
              </span>
            </header>
            <p>
              <strong>{o.guest_name}</strong> · Guest {o.guest_number}
            </p>
            <time dateTime={o.created_at}>
              {new Date(o.created_at).toLocaleString("en-GB", {
                timeZone: "Asia/Seoul",
                hour12: false,
              })}{" "}
              KST
            </time>
            <ul>
              {o.items.map((i) => (
                <li key={i.menuId}>
                  <strong>{i.quantity} ×</strong>
                  <span>
                    {i.name}
                    <small>{i.nameKo}</small>
                  </span>
                </li>
              ))}
            </ul>
            <p className="order-estimate">
              Menu estimate:{" "}
              {o.estimated_total === null
                ? "Confirm price"
                : `₩${o.estimated_total.toLocaleString("en-US")}`}
            </p>
            <footer>
              {o.status === "queued" && (
                <button
                  disabled={!!busy || o.id !== next}
                  onClick={() => void change(o, "preparing")}
                >
                  Start preparing
                </button>
              )}
              {o.status === "preparing" && (
                <button
                  disabled={!!busy}
                  onClick={() => void change(o, "ready")}
                >
                  Mark ready
                </button>
              )}
              {o.status === "ready" && (
                <button
                  disabled={!!busy}
                  onClick={() => void change(o, "served")}
                >
                  Mark served
                </button>
              )}
              {o.receipt && (
                <button onClick={() => setPrintReceipt(o.receipt)}>
                  Print receipt #{o.receipt.receipt_number}
                </button>
              )}
              {["queued", "preparing", "ready"].includes(o.status) && (
                <button
                  disabled={!!busy}
                  onClick={() => void change(o, "cancelled")}
                >
                  Cancel
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
      {loaded && !orders.length && (
        <div className="order-empty">
          {history
            ? "No orders on this date."
            : "No waiting orders. New guest orders appear here automatically."}
        </div>
      )}
      {printReceipt && (
        <section className="receipt-print-area" aria-label="Meal receipt">
          <button className="receipt-close" onClick={() => setPrintReceipt(null)}>Close</button>
          <p>BARAKA · INTERNAL MEAL RECORD</p>
          <h2>Receipt #{printReceipt.receipt_number}</h2>
          <p>Order {printReceipt.reference}</p>
          <p>{printReceipt.table_name} · {printReceipt.guest_name} (Guest {printReceipt.guest_number})</p>
          <time>{new Date(printReceipt.served_at).toLocaleString("en-GB", { timeZone: "Asia/Seoul", hour12: false })} KST</time>
          <ul>{printReceipt.items.map((item) => <li key={item.menuId}>{item.quantity} × {item.name} — {item.unitPrice === null ? "Price unconfirmed" : `₩${(item.quantity * item.unitPrice).toLocaleString("en-US")}`}</li>)}</ul>
          <strong>Estimated total: {printReceipt.estimated_total === null ? "Confirm with staff" : `₩${printReceipt.estimated_total.toLocaleString("en-US")}`}</strong>
          <p>Internal order evidence only. Amounts are estimates; this is not proof of payment or a tax invoice.</p>
          <button className="receipt-close" onClick={() => window.print()}>Print</button>
        </section>
      )}
    </main>
  );
}
