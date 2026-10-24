import { z } from "zod";
const sequentialDigits = ["012", "123", "234", "345", "456", "567", "678", "789", "987", "876", "765", "654", "543", "432", "321", "210"];
export function ownerPasswordMeetsRules(password: string) {
  const letters = password.match(/[A-Za-z]/g)?.length || 0;
  const digits = password.match(/[0-9]/g)?.length || 0;
  return letters >= 6 && digits >= 3 && /[^A-Za-z0-9\s]/.test(password) && !sequentialDigits.some((sequence) => password.includes(sequence));
}
export const ownerPasswordSchema = z.string().min(10).max(256).refine(ownerPasswordMeetsRules, {
  message: "Use at least 6 letters, 3 digits, and 1 symbol; avoid consecutive digits such as 123.",
});
export const locales = ["ko", "en", "uz", "ru"] as const;
export type Locale = (typeof locales)[number];
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  });
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const phoneSchema = z
  .string()
  .max(30)
  .transform((v) => v.replace(/[\s()-]/g, "").replace(/^\+82/, "0"))
  .pipe(z.string().regex(/^010\d{8}$/));
export const availabilitySchema = z
  .object({ date: dateSchema, guests: z.coerce.number().int().min(1).max(100) })
  .strict();
export const bookingSchema = z
  .object({
    date: dateSchema,
    time: timeSchema,
    guests: z.number().int().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    phone: phoneSchema,
    email: z
      .union([z.literal(""), z.string().trim().email().max(254)])
      .optional()
      .default(""),
    notes: z.string().trim().max(500).default(""),
    locale: z.enum(locales).default("ko"),
    consent: z.literal(true),
    optionalConsent: z.boolean().default(false),
    adult: z.literal(true),
    privacyVersion: z.string().min(1).max(40),
    idempotencyKey: z.string().uuid(),
    website: z.string().max(0).default(""),
    botToken: z.string().max(2048).default(""),
  })
  .strict()
  .refine((v) => (!v.email && !v.notes) || v.optionalConsent, {
    message: "Optional information requires consent",
    path: ["optionalConsent"],
  });
export type BookingInput = z.infer<typeof bookingSchema>;
export const statusSchema = z
  .object({
    status: z.enum([
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "no_show",
    ]),
    version: z.number().int().positive(),
  })
  .strict();
export const configSchema = z
  .object({
    enabled: z.boolean(),
    dining_minutes: z.number().int().min(15).max(360),
    slot_minutes: z.number().int().min(5).max(120),
    min_notice_minutes: z.number().int().min(0).max(43200),
    advance_days: z.number().int().min(1).max(365),
    max_party: z.number().int().min(1).max(100),
    max_concurrent_guests: z.number().int().min(1).max(1000),
    daily_booking_limit: z.number().int().min(1).max(1000),
    auto_confirm: z.boolean(),
    retention_days: z.number().int().min(1).max(90),
    privacy_version: z.string().trim().min(1).max(40),
    tables: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            name: z.string().trim().min(1).max(40),
            seats: z.number().int().min(1).max(100),
            active: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    hours: z
      .array(
        z
          .object({
            weekday: z.number().int().min(0).max(6),
            opens: z.number().int().min(0).max(1439),
            closes: z.number().int().min(1).max(1440),
          })
          .strict()
          .refine((v) => v.opens < v.closes),
      )
      .max(28),
    closures: z
      .array(
        z
          .object({ date: dateSchema, reason: z.string().trim().max(120) })
          .strict(),
      )
      .max(366),
  })
  .strict();
export class BookingError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function seoulDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function instant(date: string, minute: number) {
  return new Date(
    new Date(`${date}T00:00:00+09:00`).getTime() + minute * 60000,
  );
}
export function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export const orderedItemsSchema = z
  .object({
    orderedItems: z.string().trim().max(2000),
    version: z.number().int().positive(),
  })
  .strict();

export const guestProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[^\u0000-\u001f\u007f]*$/),
  })
  .strict();
