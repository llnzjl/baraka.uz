import { readSession, requestToken } from "@/lib/booking/sessions";
import { BookingError } from "@/lib/booking/validation";
import { createReservation } from "@/lib/booking/engine";
import { bookingSchema } from "@/lib/booking/validation";
import {
  handle,
  body,
  origin,
  limit,
  clientIp,
  verifyBot,
} from "@/lib/booking/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    origin(request);
    const session = await readSession(requestToken(request));
    if (!session) throw new BookingError("UNAUTHORIZED", 401);
    const ip = clientIp(request);
    await limit("booking", ip, 10);
    const v = bookingSchema.parse(await body(request));
    await limit("phone", v.phone, 5, 3600);
    await verifyBot(v.botToken, ip);
    return createReservation(
      v,
      undefined,
      session.kind === "guest" ? session.guest_number : undefined,
    );
  });
}
