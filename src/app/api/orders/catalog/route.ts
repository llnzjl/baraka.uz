import { handle, limit } from "@/lib/booking/http";
import { orderGuest } from "@/lib/orders/http";
import { orderCatalog } from "@/lib/orders/engine";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(async () => {
    const s = await orderGuest(request);
    await limit("order-catalog", s.id, 60, 60);
    return orderCatalog(s.id);
  });
}
