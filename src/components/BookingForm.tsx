"use client";
import Script from "next/script";
import { useEntrySession } from "./EntryGate";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { terminalStatus } from "@/lib/booking/status-copy";
import { bookingCopy } from "@/lib/booking/copy";
import { bookingSchema, Locale, seoulDate } from "@/lib/booking/validation";
import styles from "./ReservationForm.module.css";
type Availability = {
  slots: string[];
  enabled: boolean;
  retentionDays: number;
  privacyVersion: string;
  maxParty: number;
  advanceDays: number;
  policy: { url: string; controller: string; contact: string };
};
type Receipt = {
  reference: string;
  status: string;
  date: string;
  time: string;
  guests: number;
};
type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
function Challenge({
  onToken,
  reset,
}: {
  onToken: (v: string) => void;
  reset: number;
}) {
  const node = useRef<HTMLDivElement>(null),
    id = useRef<string>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (
      !ready ||
      !node.current ||
      !window.turnstile ||
      !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    )
      return;
    id.current = window.turnstile.render(node.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      action: "reservation",
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    return () => {
      if (id.current) window.turnstile?.remove(id.current);
    };
  }, [ready, onToken]);
  useEffect(() => {
    if (id.current) {
      window.turnstile?.reset(id.current);
      onToken("");
    }
  }, [reset, onToken]);
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        strategy="afterInteractive"
      />
      <div ref={node} />
    </>
  );
}
export default function BookingForm({
  initialLocale = "ko",
  adminMode,
  onBooked,
}: {
  initialLocale?: Locale;
  adminMode?: boolean;
  onBooked?: () => void;
}) {
  const { session } = useEntrySession();
  const [locale, setLocale] = useState<Locale>(initialLocale),
    [date, setDate] = useState(""),
    [guests, setGuests] = useState(2),
    [time, setTime] = useState("");
  const [data, setData] = useState<Availability | null>(null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [reload, setReload] = useState(0);
  const [botToken, setBotToken] = useState(""),
    [resetBot, setResetBot] = useState(0);
  const key = useRef(""),
    fingerprint = useRef(""),
    form = useRef<HTMLFormElement>(null);
  const [today, setToday] = useState("");
  const t = bookingCopy[locale],
    token = useCallback((v: string) => setBotToken(v), []);
  const help = {
    en: {
      choose: "Choose an available time before reserving.",
      call: "Call to reserve",
    },
    ko: {
      choose: "예약 가능한 시간을 먼저 선택해 주세요.",
      call: "전화로 예약하기",
    },
    uz: {
      choose: "Band qilishdan oldin mavjud vaqtni tanlang.",
      call: "Telefon orqali band qilish",
    },
    ru: {
      choose: "Сначала выберите доступное время.",
      call: "Забронировать по телефону",
    },
  }[locale];
  const unavailable = t.unavailable;
  const timeAvailable = Boolean(data?.slots.includes(time));
  const blocked = loading || !data?.enabled || !timeAvailable;
  const blockedMessage = loading
    ? t.loading
    : !data?.enabled
      ? unavailable
      : !data.slots.length
        ? t.empty
        : time && !timeAvailable
          ? t.conflict
          : help.choose;
  useEffect(() => setLocale(initialLocale), [initialLocale]);
  useEffect(() => {
    setDate(seoulDate());
    setToday(seoulDate());
  }, []);
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setTime("");
    fetch(
      `/api/reservations/availability?date=${encodeURIComponent(date)}&guests=${guests}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((v) => {
        if (!controller.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, guests, reload]);
  useEffect(() => {
    if (loading || data?.enabled || receipt) return;
    const timer = setTimeout(() => setReload((v) => v + 1), 20000);
    return () => clearTimeout(timer);
  }, [loading, data, receipt, reload]);
  function message(code: string) {
    if (["SLOT_UNAVAILABLE", "CONFLICT"].includes(code)) return t.conflict;
    if (code === "INVALID_INPUT") return t.invalid;
    if (code === "POLICY_CHANGED") return t.changed;
    if (code.startsWith("BOT")) return t.bot;
    if (code === "RATE_LIMITED") return t.rate;
    if (code === "UNAVAILABLE") return t.unavailable;
    return t.error;
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !data || loading) return;
    setError("");
    const f = new FormData(e.currentTarget);
    const payload = {
      date,
      time,
      guests,
      name: String(f.get("name")),
      phone: String(f.get("phone")),
      email: String(f.get("email") || ""),
      notes: String(f.get("notes") || ""),
      consent: f.get("consent") === "on",
      optionalConsent: f.get("optionalConsent") === "on",
      adult: f.get("adult") === "on",
      locale,
      privacyVersion: data.privacyVersion,
      website: String(f.get("website") || ""),
    };
    const signature = JSON.stringify(payload);
    if (signature !== fingerprint.current) {
      key.current = crypto.randomUUID();
      fingerprint.current = signature;
    }
    const parsed = bookingSchema.safeParse({
      ...payload,
      idempotencyKey: key.current,
      botToken,
    });
    if (!parsed.success) {
      setError(t.invalid);
      (
        form.current?.elements.namedItem(
          String(parsed.error.issues[0]?.path[0]),
        ) as HTMLElement | null
      )?.focus();
      return;
    }
    if (!adminMode && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !botToken) {
      setError(t.bot);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(
        adminMode ? "/api/admin/reservations" : "/api/reservations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(parsed.data),
        },
      );
      const result = await r.json();
      if (!r.ok) {
        setError(message(result.error));
        if (
          ["SLOT_UNAVAILABLE", "CONFLICT", "POLICY_CHANGED"].includes(
            result.error,
          )
        )
          setReload((x) => x + 1);
        return;
      }
      setReceipt(result);
      onBooked?.();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
      setResetBot((x) => x + 1);
    }
  }
  return (
    <div className="booking-flow" lang={locale}>
      <label className="booking-language">
        {t.language}
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
          <option value="uz">O‘zbekcha</option>
          <option value="ru">Русский</option>
        </select>
      </label>
      <div className={styles.reservation}>
        <div className={styles.introduction}>
          <p className={styles.eyebrow}>BARAKA · RESERVATIONS</p>
          <h2>{t.title}</h2>
          <p className={styles.description}>{t.intro}</p>
          <a className={styles.phone} href="tel:+82432688329">
            <strong>043-268-8329</strong>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
        {receipt ? (
          <div className="booking-receipt" role="status">
            <p className="eyebrow">{t.reference}</p>
            <h3>
              {receipt.status === "confirmed"
                ? t.confirmed
                : receipt.status === "pending"
                  ? t.pending
                  : terminalStatus[receipt.status]?.[locale] || t.error}
            </h3>
            <strong>{receipt.reference}</strong>
            <p>
              {receipt.date} · {receipt.time} KST · {receipt.guests} {t.guests}
            </p>
            <p>{t.saved}</p>
            <button
              className={styles.primary}
              onClick={() => {
                setReceipt(null);
                key.current = "";
                fingerprint.current = "";
                setReload((x) => x + 1);
              }}
            >
              {t.newBooking}
            </button>
          </div>
        ) : (
          <form ref={form} onSubmit={submit} className={styles.form}>
            {adminMode && <p>{t.manual}</p>}
            <fieldset disabled={busy} className="booking-fields">
              <div className={styles.row}>
                <label className={styles.field}>
                  {t.date}
                  <input
                    type="date"
                    name="date"
                    value={date}
                    min={today || undefined}
                    max={
                      data
                        ? seoulDate(
                            new Date(Date.now() + data.advanceDays * 86400000),
                          )
                        : undefined
                    }
                    onChange={(e) => {
                      setData(null);
                      setDate(e.target.value);
                    }}
                    required
                  />
                </label>
                <label className={styles.field}>
                  {t.guests}
                  <input
                    type="number"
                    name="guests"
                    min="1"
                    max={data?.maxParty || 100}
                    value={guests}
                    onChange={(e) => {
                      setData(null);
                      setGuests(Number(e.target.value));
                    }}
                    required
                  />
                </label>
              </div>
              <fieldset className="booking-slots">
                <legend>{t.time}</legend>
                {data?.enabled && (
                  <label className="booking-clock">
                    <span>{locale === "ko" ? "예약 시간 (10:00 AM–12:00 AM)" : locale === "uz" ? "Vaqtni tanlang (10:00–00:00)" : locale === "ru" ? "Время (10:00–00:00)" : "Choose a time (10:00 AM–12:00 AM)"}</span>
                    <input
                      aria-label={t.time}
                      type="time"
                      name="time"
                      min="10:00"
                      max="23:59"
                      step="60"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                    />
                  </label>
                )}
                <p role="status">
                  {loading
                    ? t.loading
                    : !data?.enabled
                      ? unavailable
                      : !data.slots.length
                        ? t.empty
                        : time && !timeAvailable
                          ? t.conflict
                          : ""}
                </p>
              </fieldset>
              <div className={styles.field}>
                <label htmlFor="booking-name">{t.name}</label>
                <input
                  id="booking-name"
                  name="name"
                  autoComplete="name"
                  defaultValue={
                    !adminMode && session?.kind === "guest"
                      ? session.displayName
                      : undefined
                  }
                  maxLength={80}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="booking-phone">{t.phone}</label>
                <input
                  id="booking-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="010-1234-5678"
                  maxLength={30}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="booking-email">{t.email}</label>
                <input
                  id="booking-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="booking-notes">{t.notes}</label>
                <textarea
                  id="booking-notes"
                  name="notes"
                  rows={3}
                  maxLength={500}
                  aria-describedby="booking-notes-hint"
                />
                <small id="booking-notes-hint">{t.notesHint}</small>
              </div>
              <div className="booking-honeypot" aria-hidden="true">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {data && (
                <div className="booking-privacy">
                  <p>
                    {t.controller}: {data.policy.controller || "—"}
                  </p>
                  <p>
                    {t.contact}: {data.policy.contact || "—"}
                  </p>
                  <p>
                    {t.retention} {data.retentionDays} {t.days}
                  </p>
                  {data.policy.url && (
                    <a
                      href={data.policy.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.privacy} ↗
                    </a>
                  )}
                  <span> · v{data.privacyVersion}</span>
                </div>
              )}
              <label className="booking-consent">
                <input type="checkbox" name="adult" required />
                {t.adult}
              </label>
              <label className="booking-consent">
                <input type="checkbox" name="consent" required />
                {t.requiredConsent}
              </label>
              <label className="booking-consent">
                <input type="checkbox" name="optionalConsent" />
                {t.optionalConsent}
              </label>
            </fieldset>
            {!adminMode && <Challenge onToken={token} reset={resetBot} />}
            <p role="alert" className={styles.error}>
              {error}
            </p>
            <button
              type={blocked ? "button" : "submit"}
              className={styles.primary}
              disabled={busy}
              onClick={blocked ? () => setError(blockedMessage) : undefined}
            >
              {busy ? t.sending : t.submit}
              <span aria-hidden="true">↗</span>
            </button>
            {!loading && !data?.enabled && (
              <a className={styles.secondary} href="tel:+82432688329">
                {help.call} · 043-268-8329
              </a>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
