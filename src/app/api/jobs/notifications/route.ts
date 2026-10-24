import { handle, cron } from "@/lib/booking/http";
import { processNotifications } from "@/lib/booking/notifications";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    cron(request);
    return processNotifications();
  });
}
