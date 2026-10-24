import { handle, admin } from "@/lib/booking/http";
import { adminOrders } from "@/lib/orders/engine";
import { dateSchema } from "@/lib/booking/validation";
import { syncRecordsSafely } from "@/lib/booking/records";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(async () => {
    const user = await admin(request);
    const date = new URL(request.url).searchParams.get("date");
    return {
      ...(await adminOrders(
        user.id,
        date === null ? undefined : dateSchema.parse(date),
      )),
      recordsSynced: (await syncRecordsSafely()).synced,
    };
  });
}
