"use client";
import Link from "next/link";
import OwnerTabs from "./OwnerTabs";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { configSchema, seoulDate, clock } from "@/lib/booking/validation";
import BookingForm from "./BookingForm";
import { apiFetch, downloadApiFile } from "@/lib/client/api";
type Config = z.infer<typeof configSchema>;
type Reservation = {
  id: string;
  reference: string;
  guest_number: string | null;
  guest_name: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  ordered_items: string;
  guests: number;
  starts_at: string;
  ends_at: string;
  status: string;
  version: number;
  tables: string[];
};
const labels: Record<string, string> = {
  enabled: "Online bookings enabled",
  dining_minutes: "Dining duration (minutes)",
  slot_minutes: "Slot interval (minutes)",
  min_notice_minutes: "Minimum notice (minutes)",
  advance_days: "Booking horizon (days)",
  max_party: "Maximum party size",
  max_concurrent_guests: "Concurrent guest limit",
  daily_booking_limit: "Daily booking limit",
  auto_confirm: "Automatically confirm",
  retention_days: "Retention after visit (days)",
  privacy_version: "Privacy notice version",
};
const errors: Record<string, string> = {
  ACTIVE_BOOKINGS_CONFIG_LOCKED:
    "This change would displace an active reservation. Keep its table, capacity and service hours, or contact the guest and resolve the booking first.",
  STALE_VERSION:
    "Another staff member updated this booking. Refresh and retry.",
  FORBIDDEN:
    "This account is not authorized. Ask the owner to add your Supabase user ID to booking.admin_users.",
  MFA_REQUIRED: "Complete two-factor authentication.",
  CONFIG_INCOMPLETE:
    "Configure tables, hours, and all required services before enabling bookings.",
  TOO_EARLY:
    "Complete or mark no-show only after the booked dining period ends.",
  TOO_LATE: "A past booking cannot be confirmed.",
  INVALID_INPUT: "Check all fields and ensure hours do not overlap.",
  CONFLICT:
    "Conflicting or duplicate configuration. Check table names and opening hours.",
  UNAVAILABLE: "Service unavailable. Check database and service configuration.",
};
export default function ReservationAdmin() {
  const [orderDrafts, setOrderDrafts] = useState<
    Record<string, { text: string; version: number }>
  >({});
  const [recordsSynced, setRecordsSynced] = useState(true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [date, setDate] = useState(""),
    [rows, setRows] = useState<Reservation[]>([]),
    [authorized, setAuthorized] = useState(false),
    [role, setRole] = useState(""),
    [config, setConfig] = useState<Config | null>(null),
    [manual, setManual] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => setDate(seoulDate()), []);
  const refreshSequence = useRef(0);
  const api = useCallback(
    async (path: string, method = "GET", payload?: unknown) => {
      const r = await apiFetch(path, {
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) {
        if ([401, 403].includes(r.status)) {
          setRows([]);
          setAuthorized(false);
          setConfig(null);
        }
        throw new Error(errors[data.error] || data.error || "Request failed");
      }
      return data;
    },
    [],
  );
  const refresh = useCallback(async () => {
    if (!date) return;
    const sequence = ++refreshSequence.current;
    try {
      const data = await api(`/api/admin/reservations?date=${date}`);
      if (sequence !== refreshSequence.current) return;
      setRows(data.reservations);
      setRecordsSynced(data.recordsSynced !== false);
      setRole(data.role);
      setAuthorized(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, date]);
  useEffect(() => {
    setRows([]);
    void refresh();
    const updates = setInterval(() => void refresh(), 15000);
    return () => clearInterval(updates);
  }, [refresh]);
  async function saveOrder(r: Reservation) {
    const draft = orderDrafts[r.id];
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/reservations/${r.id}`, "PATCH", {
        orderedItems: draft.text,
        version: draft.version,
      });
      setOrderDrafts((previous) => {
        const next = { ...previous };
        delete next[r.id];
        return next;
      });
      setNotice("Ordered items saved.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change(r: Reservation, status: string) {
    if (
      status === "cancelled" &&
      !window.confirm(`Cancel ${r.reference}? The table will become available.`)
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/reservations/${r.id}`, "PATCH", {
        status,
        version: r.version,
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function settings() {
    setError("");
    try {
      const c = await api("/api/admin/config");
      setConfig(
        configSchema.parse({
          enabled: c.enabled,
          dining_minutes: c.dining_minutes,
          slot_minutes: c.slot_minutes,
          min_notice_minutes: c.min_notice_minutes,
          advance_days: c.advance_days,
          max_party: c.max_party,
          max_concurrent_guests: c.max_concurrent_guests,
          daily_booking_limit: c.daily_booking_limit,
          auto_confirm: c.auto_confirm,
          retention_days: c.retention_days,
          privacy_version: c.privacy_version,
          tables: c.tables,
          hours: c.hours,
          closures: c.closures,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/config", "PATCH", config);
      setNotice("Configuration saved.");
      await settings();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const format = (s: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(s));
  const live = rows.filter((r) => ["pending", "confirmed"].includes(r.status));
  return (
    <main className="admin-shell">
      <Link className="text-link" href="/">
        BARAKA · Return to website
      </Link>
      <OwnerTabs />
      <p className="eyebrow">RESTAURANT MANAGEMENT</p>
      <h1>Reservations</h1>
      <p className="admin-error" role="alert">
        {error}
      </p>
      <p role="status">{notice}</p>
      <>
        <div className="admin-toolbar">
          <label>
            Date (Asia/Seoul){" "}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button onClick={() => void refresh()}>Refresh</button>
          {authorized && (
            <button
              className="text-link"
              onClick={() => void downloadApiFile("/api/admin/reservations/records", "reservations.txt").catch(() => setError("Download unavailable"))}
            >
              Download reservation records (.txt)
            </button>
          )}
          {authorized && (
            <button onClick={() => setManual(!manual)}>
              Manual reservation
            </button>
          )}
          {role === "manager" && authorized && (
            <button onClick={() => void settings()}>Hours & capacity</button>
          )}
          <button
            onClick={() =>
              void apiFetch("/api/session", { method: "DELETE" }).then((r) => {
                if (r.ok) {
                  localStorage.removeItem("baraka-session-token");
                  window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);
                }
                else setError("Sign out failed. Please retry.");
              })
            }
          >
            Sign out
          </button>
        </div>
        {authorized && (
          <>
            <div className="admin-calendar" aria-label="Daily calendar">
              {Array.from({ length: 7 }, (_, i) => {
                const d = seoulDate(
                  new Date(
                    new Date(`${date}T00:00:00+09:00`).getTime() +
                      (i - 3) * 86400000,
                  ),
                );
                return (
                  <button
                    key={d}
                    aria-pressed={d === date}
                    onClick={() => setDate(d)}
                  >
                    {d.slice(5)}
                  </button>
                );
              })}
            </div>
            <p className="admin-notice">
              {live.length} active reservations ·{" "}
              {live.reduce((n, r) => n + r.guests, 0)} expected guests ·{" "}
              {rows.length} total records. Pending bookings hold a table until
              staff confirm or cancel.
            </p>
            {!recordsSynced && (
              <p role="status">
                Bookings are saved in the database. The project text file could
                not update yet; check server file permissions or download the
                current records above.
              </p>
            )}
            <div className="admin-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time (KST)</th>
                    <th>Guest</th>
                    <th>Party / tables</th>
                    <th>Ordered items</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {format(r.starts_at)}–{format(r.ends_at)}
                        <small>{r.reference}</small>
                      </td>
                      <td>
                        {r.guest_name || r.name}
                        {r.guest_name && r.guest_name !== r.name && (
                          <small>Reservation name: {r.name}</small>
                        )}
                        {r.guest_number && (
                          <small>Guest {r.guest_number}</small>
                        )}
                        <small>
                          <a href={`tel:${r.phone}`}>{r.phone}</a>
                        </small>
                        {r.email && <small>{r.email}</small>}
                        {r.notes && <small>{r.notes}</small>}
                      </td>
                      <td>
                        {r.guests} guests<small>{r.tables.join(", ")}</small>
                      </td>
                      <td>
                        <label htmlFor={`order-${r.id}`}>
                          What they ordered
                        </label>
                        <textarea
                          id={`order-${r.id}`}
                          rows={3}
                          maxLength={2000}
                          value={orderDrafts[r.id]?.text ?? r.ordered_items}
                          placeholder="Enter dishes and quantities"
                          onChange={(e) =>
                            setOrderDrafts((previous) => ({
                              ...previous,
                              [r.id]: {
                                text: e.target.value,
                                version: previous[r.id]?.version ?? r.version,
                              },
                            }))
                          }
                        />
                        <button
                          disabled={busy || !orderDrafts[r.id]}
                          onClick={() => void saveOrder(r)}
                        >
                          Save order
                        </button>
                        {orderDrafts[r.id] && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              setOrderDrafts((previous) => {
                                const next = { ...previous };
                                delete next[r.id];
                                return next;
                              })
                            }
                          >
                            Discard changes
                          </button>
                        )}
                      </td>
                      <td>
                        <span className="admin-badge">{r.status}</span>
                      </td>
                      <td>
                        {r.status === "pending" && (
                          <button
                            disabled={busy}
                            onClick={() => void change(r, "confirmed")}
                          >
                            Confirm
                          </button>
                        )}
                        {["pending", "confirmed"].includes(r.status) && (
                          <button
                            disabled={busy}
                            onClick={() => void change(r, "cancelled")}
                          >
                            Cancel
                          </button>
                        )}
                        {r.status === "confirmed" && (
                          <>
                            <button
                              disabled={
                                busy || new Date(r.ends_at) > new Date()
                              }
                              onClick={() => void change(r, "completed")}
                            >
                              Completed
                            </button>
                            <button
                              disabled={
                                busy || new Date(r.ends_at) > new Date()
                              }
                              onClick={() => void change(r, "no_show")}
                            >
                              No-show
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p>No reservations for this day.</p>}
            </div>
            {manual && (
              <section className="admin-manual">
                <BookingForm
                  initialLocale="en"
                  adminMode
                  onBooked={() => void refresh()}
                />
              </section>
            )}
            {config && role === "manager" && (
              <form className="admin-settings" onSubmit={save}>
                <h2>Hours & capacity</h2>
                <p>
                  Enter the restaurant’s actual settings. Tables are allocated
                  individually; tables are not automatically combined. Changes
                  that displace existing bookings are rejected. Closing time may
                  be 24:00; split overnight service into two weekdays.
                </p>
                <div className="admin-config-grid">
                  {Object.entries(labels).map(([key, label]) => {
                    const value = config[key as keyof Config];
                    return (
                      <label key={key}>
                        {label}
                        {typeof value === "boolean" ? (
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                [key]: e.target.checked,
                              })
                            }
                          />
                        ) : (
                          <input
                            type={typeof value === "number" ? "number" : "text"}
                            value={value as string | number}
                            required
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                [key]:
                                  typeof value === "number"
                                    ? Number(e.target.value)
                                    : e.target.value,
                              })
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
                <h3>Dining tables</h3>
                {config.tables.map((t, i) => (
                  <div className="admin-config-row" key={t.id || i}>
                    <label>
                      Name{" "}
                      <input
                        value={t.name}
                        maxLength={40}
                        required
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            tables: config.tables.map((x, j) =>
                              j === i ? { ...x, name: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Seats{" "}
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={t.seats}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            tables: config.tables.map((x, j) =>
                              j === i
                                ? { ...x, seats: Number(e.target.value) }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Active{" "}
                      <input
                        type="checkbox"
                        checked={t.active}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            tables: config.tables.map((x, j) =>
                              j === i ? { ...x, active: e.target.checked } : x,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      tables: [
                        ...config.tables,
                        { name: "", seats: 2, active: false },
                      ],
                    })
                  }
                >
                  Add table
                </button>
                <h3>Weekly opening hours</h3>
                {config.hours.map((h, i) => (
                  <div className="admin-config-row" key={i}>
                    <select
                      aria-label="Weekday"
                      value={h.weekday}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          hours: config.hours.map((x, j) =>
                            i === j
                              ? { ...x, weekday: Number(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    >
                      {[
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                      ].map((d, n) => (
                        <option key={d} value={n}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {(["opens", "closes"] as const).map((k) => (
                      <label key={k}>
                        {k}
                        <input
                          aria-label={k}
                          placeholder="HH:MM"
                          pattern="([01][0-9]|2[0-4]):[0-5][0-9]"
                          defaultValue={clock(h[k])}
                          onBlur={(e) => {
                            const [a, b] = e.target.value
                              .split(":")
                              .map(Number);
                            if (Number.isFinite(a) && Number.isFinite(b))
                              setConfig({
                                ...config,
                                hours: config.hours.map((x, j) =>
                                  i === j ? { ...x, [k]: a * 60 + b } : x,
                                ),
                              });
                          }}
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          hours: config.hours.filter((_, j) => i !== j),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      hours: [
                        ...config.hours,
                        { weekday: 0, opens: 720, closes: 1200 },
                      ],
                    })
                  }
                >
                  Add hours (review before saving)
                </button>
                <h3>Closed dates</h3>
                {config.closures.map((d, i) => (
                  <div className="admin-config-row" key={i}>
                    <input
                      aria-label="Closed date"
                      type="date"
                      value={d.date}
                      required
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          closures: config.closures.map((x, j) =>
                            i === j ? { ...x, date: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label="Closure reason"
                      value={d.reason}
                      maxLength={120}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          closures: config.closures.map((x, j) =>
                            i === j ? { ...x, reason: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          closures: config.closures.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      closures: [
                        ...config.closures,
                        { date: seoulDate(), reason: "" },
                      ],
                    })
                  }
                >
                  Add closed date
                </button>
                <div className="admin-toolbar">
                  <button disabled={busy} type="submit">
                    Save configuration
                  </button>
                  <button type="button" onClick={() => setConfig(null)}>
                    Close settings
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </>
    </main>
  );
}
