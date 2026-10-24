import { availability } from "@/lib/booking/engine";
import { availabilitySchema } from "@/lib/booking/validation";
import { handle, limit, clientIp } from "@/lib/booking/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    await limit("availability", clientIp(request), 90, 60);
    const v = availabilitySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return availability(v.date, v.guests);
  });
}
