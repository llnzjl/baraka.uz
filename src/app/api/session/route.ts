import { sessionView, changeGuestName } from "@/lib/booking/guest-profile";
import { guestProfileSchema } from "@/lib/booking/validation";
import { z } from "zod";
import { handle, body, origin, limit, clientIp, response } from "@/lib/booking/http";
import {
  newSession,
  readSession,
  requestToken,
  sessionCookie,
  verifyOwner,
  endSession,
} from "@/lib/booking/sessions";
import { BookingError } from "@/lib/booking/validation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(async () => {
    const s = await readSession(requestToken(request));
    return {
      session: s ? sessionView(s) : null,
    };
  });
}
export async function POST(request: Request) {
  let token: string | undefined;
  const result = await handle(async () => {
    origin(request);
    await limit("entry", clientIp(request), 120, 600);
    const v = z
      .object({
        kind: z.enum(["owner", "guest"]),
        username: z.string().max(100).optional(),
        password: z.string().max(256).optional(),
      })
      .strict()
      .parse(await body(request));
    if (v.kind === "owner") {
      await limit("owner-login-ip", clientIp(request), 10, 600);
      await limit("owner-login", "owner", 20, 600);
    }
    if (
      v.kind === "owner" &&
      !(await verifyOwner(v.username || "", v.password || ""))
    )
      throw new BookingError("INVALID_LOGIN", 401);
    const created = await newSession(v.kind, requestToken(request));
    token = created.token;
    return sessionView(created.session);
  });
  if (token && process.env.BARAKA_EDGE === "true") {
    const view = await result.json();
    return response({ ...view, accessToken: token });
  }
  if (token) result.headers.append("Set-Cookie", `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return result;
}
export async function DELETE(request: Request) {
  const result = await handle(async () => {
    origin(request);
    await endSession(requestToken(request));
    return { ok: true };
  });
  if (result.ok && process.env.BARAKA_EDGE !== "true") result.headers.append("Set-Cookie", `${sessionCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return result;
}

export async function PATCH(request: Request) {
  return handle(async () => {
    origin(request);
    const token = requestToken(request);
    const session = await readSession(token);
    if (session?.kind !== "guest") throw new BookingError("UNAUTHORIZED", 401);
    await limit("guest-profile", session.id, 20, 600);
    const v = guestProfileSchema.parse(await body(request));
    return { session: await changeGuestName(token, v.displayName) };
  });
}
