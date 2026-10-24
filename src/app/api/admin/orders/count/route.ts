import { handle, admin } from "@/lib/booking/http";
import { database } from "@/lib/booking/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(async () => {
    await admin(request);
    return (
      await database().query(
        "SELECT count(*)::int AS waiting FROM booking.dining_orders WHERE status='queued' AND purge_at>now()",
      )
    ).rows[0];
  });
}
