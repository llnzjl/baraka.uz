"use client";
import Script from "next/script";
import { useEntrySession } from "./EntryGate";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { terminalStatus } from "@/lib/booking/status-copy";
import { bookingCopy } from "@/lib/booking/copy";
import { bookingSchema, Locale, seoulDate } from "@/lib/booking/validation";
import styles from "./ReservationForm.module.css";
import { apiFetch } from "@/lib/client/api";
type Availability = {
  slots: string[];
  enabled: boolean;
  diningMinutes: number;
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
type ServicePeriod = "noon" | "evening";
const serviceWindow: Record<ServicePeriod, { start: number; end: number }> = {
  noon: { start: 11 * 60, end: 14 * 60 },
  evening: { start: 17 * 60, end: 24 * 60 },
};
function formatSlotTime(value: string, locale: Locale) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(Date.UTC(2020, 0, 1, hours, minutes));
  const language = { ko: "ko-KR", en: "en-US", uz: "uz-UZ", ru: "ru-RU" }[locale];
  return new Intl.DateTimeFormat(language, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}
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
    [time, setTime] = useState(""),
    [service, setService] = useState<ServicePeriod | null>(null);
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
  const serviceCopy = {
    en: {
      noon: "Noon · 11:00 AM–2:00 PM",
      evening: "Evening · 5:00 PM–12:00 AM",
      choose: "Choose Noon or Evening, then select an available time.",
      none: "No available times in this service. Choose the other service or another date.",
      available: "Available",
      unavailable: "Unavailable",
      intro: "Choose Noon (11:00 AM–2:00 PM) or Evening (5:00 PM–12:00 AM). Available starts are shown every 30 minutes in Korea Standard Time.",
    },
    ko: {
      noon: "점심 · 오전 11:00–오후 2:00",
      evening: "저녁 · 오후 5:00–자정",
      choose: "점심 또는 저녁을 고른 다음 예약 시간을 선택해 주세요.",
      none: "이 시간대에 예약 가능한 시간이 없습니다. 다른 시간대나 날짜를 선택해 주세요.",
      available: "예약 가능",
      unavailable: "예약 불가",
      intro: "점심(오전 11시~오후 2시) 또는 저녁(오후 5시~자정)을 선택해 주세요. 예약 가능한 시간은 30분 간격으로 표시됩니다.",
    },
    uz: {
      noon: "Tushlik · 11:00–14:00",
      evening: "Kechki ovqat · 17:00–00:00",
      choose: "Tushlik yoki kechki ovqatni, so‘ng bo‘sh vaqtni tanlang.",
      none: "Bu vaqt oralig‘ida bo‘sh joy yo‘q. Boshqa vaqt yoki sanani tanlang.",
      available: "Bo‘sh",
      unavailable: "Bo‘sh emas",
      intro: "Tushlik (11:00–14:00) yoki kechki ovqatni (17:00–00:00) tanlang. Bo‘sh vaqtlar 30 daqiqalik oraliqda ko‘rsatiladi.",
    },
    ru: {
      noon: "Обед · 11:00–14:00",
      evening: "Вечер · 17:00–00:00",
      choose: "Выберите обед или вечер, затем доступное время.",
      none: "В это время нет свободных мест. Выберите другой период или дату.",
      available: "Доступно",
      unavailable: "Недоступно",
      intro: "Выберите обед (11:00–14:00) или вечер (17:00–00:00). Доступное время показывается с интервалом 30 минут.",
    },
  }[locale];
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
  const serviceTimes = service && data
    ? Array.from(
        { length: Math.ceil((serviceWindow[service].end - serviceWindow[service].start) / 30) },
        (_, index) => serviceWindow[service].start + index * 30,
      )
        .filter((minute) => minute + data.diningMinutes <= serviceWindow[service].end)
        .map((minute) => `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`)
    : [];
  const serviceSlots = serviceTimes.filter((slot) => data?.slots.includes(slot));
  const timeAvailable = Boolean(time && serviceSlots.includes(time));
  const blocked = loading || !data?.enabled || !timeAvailable;
  const blockedMessage = loading
    ? t.loading
    : !data?.enabled
      ? unavailable
      : !data.slots.length
        ? t.empty
          : !service
            ? serviceCopy.choose
            : !serviceSlots.length
              ? serviceCopy.none
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
    apiFetch(
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
      const r = await apiFetch(
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
          <p className={styles.description}>{serviceCopy.intro}</p>
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
              {receipt.date} · {formatSlotTime(receipt.time, locale)} KST · {receipt.guests} {t.guests}
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
                      setService(null);
                      setTime("");
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
                      setService(null);
                      setTime("");
                      setGuests(Number(e.target.value));
                    }}
                    required
                  />
                </label>
              </div>
              <fieldset className="booking-slots">
                <legend>{t.time}</legend>
                {data?.enabled && (
                  <>
                    <div className="booking-service-buttons" role="group" aria-label={t.time}>
                      <button
                        type="button"
                        className="booking-service-button"
                        aria-pressed={service === "noon"}
                        onClick={() => { setService("noon"); setTime(""); setError(""); }}
                      >
                        {serviceCopy.noon}
                      </button>
                      <button
                        type="button"
                        className="booking-service-button"
                        aria-pressed={service === "evening"}
                        onClick={() => { setService("evening"); setTime(""); setError(""); }}
                      >
                        {serviceCopy.evening}
                      </button>
                    </div>
                    {service && (
                      <div className="booking-time-options" role="group" aria-label={serviceCopy[service]}>
                        {serviceTimes.map((slot) => {
                          const available = serviceSlots.includes(slot);
                          const label = formatSlotTime(slot, locale);
                          return (
                            <button
                              key={slot}
                              type="button"
                              className="booking-time-button"
                              disabled={!available}
                              aria-label={`${label} · ${available ? serviceCopy.available : serviceCopy.unavailable}`}
                              aria-pressed={time === slot}
                              onClick={() => { setTime(slot); setError(""); }}
                            >
                              {label}{!available && <small className="booking-time-unavailable">{serviceCopy.unavailable}</small>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                <p role="status">
                  {loading
                    ? t.loading
                    : !data?.enabled
                      ? unavailable
                      : !data.slots.length
                        ? t.empty
                          : !service
                            ? serviceCopy.choose
                            : !serviceSlots.length
                              ? serviceCopy.none
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
