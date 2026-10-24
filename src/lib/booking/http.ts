import { readSession, requestToken } from "./sessions";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { database } from "./db";
import { BookingError } from "./validation";
import { isIP } from "node:net";

export function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function handle(fn: () => Promise<unknown>) {
  try {
    return response(await fn());
  } catch (e) {
    if (e instanceof BookingError) return response({ error: e.code }, e.status);
    if (e instanceof z.ZodError)
      return response(
        {
          error: "INVALID_INPUT",
          fields: e.issues.map((i) => i.path.join(".")),
        },
        400,
      );
    const code = (e as { code?: string })?.code;
    if (["23P01", "23505", "40001", "40P01", "55P03"].includes(code || ""))
      return response({ error: "CONFLICT" }, 409);
    // No raw DB errors, connection strings, request bodies, or PII in logs/responses.
    console.error(
      "Booking service failure",
      code && /^[A-Z0-9]{5}$/.test(code) ? code : "SERVICE_ERROR",
    );
    return response({ error: "UNAVAILABLE" }, 503);
  }
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new BookingError("INVALID_INPUT", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new BookingError("INVALID_INPUT");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 32768) {
      await reader.cancel();
      throw new BookingError("BODY_TOO_LARGE", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BookingError("INVALID_INPUT");
  }
}
export function origin(request: Request) {
  const expected = process.env.APP_ORIGIN;
  if (process.env.NODE_ENV === "production" && !expected)
    throw new BookingError("UNAVAILABLE", 503);
  const origin = request.headers.get("origin");
  if (!origin || origin !== (expected || new URL(request.url).origin))
    throw new BookingError("FORBIDDEN", 403);
}
export function clientIp(request: Request) {
  const header = process.env.TRUSTED_IP_HEADER;
  if (!header && process.env.NODE_ENV === "production")
    throw new BookingError("UNAVAILABLE", 503);
  // Configure a header overwritten by the deployment's trusted reverse proxy, never arbitrary forwarded headers.
  if (!header) return "local";
  // Proxies append the connected client address to X-Forwarded-For. Prefer
  // the last valid hop so a caller cannot choose a rate-limit bucket by
  // prepending a forged address. A proxy that overwrites the field yields one.
  const chain = request.headers.get(header)?.split(",") || [];
  for (let i = chain.length - 1; i >= 0; i--) {
    const candidate = chain[i].trim();
    if (candidate.length <= 45 && isIP(candidate)) return candidate;
  }
  return "unknown";
}
export async function limit(
  scope: string,
  identifier: string,
  max: number,
  seconds = 600,
) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret && process.env.NODE_ENV === "production")
    throw new BookingError("UNAVAILABLE", 503);
  const key = createHmac("sha256", secret || "local-development-only")
    .update(`${scope}:${identifier}`)
    .digest("hex");
  const r = await database().query(
    `INSERT INTO booking.rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second')
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN booking.rate_limits.expires_at<=now() THEN 1 ELSE booking.rate_limits.count+1 END,
 expires_at=CASE WHEN booking.rate_limits.expires_at<=now() THEN now()+$2*interval '1 second' ELSE booking.rate_limits.expires_at END RETURNING count`,
    [key, seconds],
  );
  if (r.rows[0].count > max) throw new BookingError("RATE_LIMITED", 429);
}
export async function verifyBot(token: string, ip: string) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.BOT_PROTECTION_DISABLED === "true"
  )
    return;
  if (!process.env.TURNSTILE_SECRET_KEY || !token)
    throw new BookingError("BOT_REQUIRED", 400);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(ip !== "unknown" && ip !== "local" ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  const data = await res.json();
  if (
    !data.success ||
    data.action !== "reservation" ||
    data.hostname !==
      new URL(process.env.APP_ORIGIN || "http://localhost:3000").hostname
  )
    throw new BookingError("BOT_FAILED", 400);
}
export async function admin(request: Request, _manager = false) {
  const local = await readSession(requestToken(request));
  if (local?.kind !== "owner") throw new BookingError("UNAUTHORIZED", 401);
  await limit("admin", local.id, 180, 60);
  return { id: local.id, role: "manager" as const };
}
export async function owner(request: Request) {
  const local = await readSession(requestToken(request));
  if (local?.kind !== "owner") throw new BookingError("UNAUTHORIZED", 401);
  await limit("admin", local.id, 180, 60);
  return { id: local.id, role: "manager" as const };
}
export function cron(request: Request) {
  const secret = process.env.CRON_SECRET || "",
    given = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (
    secret.length < 32 ||
    Buffer.byteLength(given) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  )
    throw new BookingError("UNAUTHORIZED", 401);
}
