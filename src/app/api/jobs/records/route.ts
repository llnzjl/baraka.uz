import { handle, cron } from "@/lib/booking/http";
import { syncRecords } from "@/lib/booking/records";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    cron(request);
    return syncRecords(true);
  });
}
