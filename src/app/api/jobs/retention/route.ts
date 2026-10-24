import { handle, cron } from "@/lib/booking/http";
import { purgeExpired } from "@/lib/booking/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handle(async () => {
    cron(request);
    return purgeExpired();
  });
}
